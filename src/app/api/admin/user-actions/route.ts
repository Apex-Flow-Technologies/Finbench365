import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/api/requireAdmin';

type Action = 'suspend' | 'activate' | 'revokeCourse' | 'demote' | 'extendAccess';

export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const { action, targetUserId, courseId, extraDays } = await req.json() as {
      action: Action;
      targetUserId: string;
      courseId?: string;
      extraDays?: number;
    };

    if (!action || !targetUserId) {
      return NextResponse.json({ error: 'Missing action or targetUserId' }, { status: 400 });
    }

    const targetRef = adminDb.collection('users').doc(targetUserId);

    // Suspending or demoting yourself is always a mistake, and if you are the
    // last admin it is an unrecoverable one — no remaining account could undo
    // it, and role is not writable by the account itself under the rules.
    if ((action === 'suspend' || action === 'demote') && targetUserId === check.uid) {
      return NextResponse.json(
        { error: 'You cannot suspend or remove admin access from your own account.' },
        { status: 400 },
      );
    }

    if (action === 'demote') {
      // Demotion only. There is deliberately no promotion path here: granting
      // admin stays a considered action taken in the Firebase console, so a
      // compromised admin session cannot mint further admins.
      await targetRef.set({
        role: 'student',
        roleChangedAt: FieldValue.serverTimestamp(),
        roleChangedBy: check.uid,
      }, { merge: true });
      return NextResponse.json({ success: true });
    }

    if (action === 'suspend') {
      await targetRef.set({ suspended: true, suspendedAt: FieldValue.serverTimestamp(), suspendedBy: check.uid }, { merge: true });
      return NextResponse.json({ success: true });
    }

    if (action === 'activate') {
      await targetRef.set({ suspended: false, reactivatedAt: FieldValue.serverTimestamp(), reactivatedBy: check.uid }, { merge: true });
      return NextResponse.json({ success: true });
    }

    if (action === 'revokeCourse') {
      if (!courseId) {
        return NextResponse.json({ error: 'Missing courseId for revokeCourse' }, { status: 400 });
      }
      await targetRef.update({
        [`enrolledCourses.${courseId}`]: FieldValue.delete(),
      });

      // Access only. This marks the order revoked, NOT refunded — the previous
      // version wrote status 'refunded' while never contacting Razorpay, so the
      // ledger claimed money had been returned when none had moved. Use the
      // 'refund' action below to actually return funds.
      const ordersSnap = await adminDb.collection('orders')
        .where('userId', '==', targetUserId)
        .where('courseId', '==', courseId)
        .where('status', '==', 'success')
        .get();
      const batch = adminDb.batch();
      ordersSnap.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        batch.update(doc.ref, {
          status: 'revoked',
          revokedAt: FieldValue.serverTimestamp(),
          revokedBy: check.uid,
        });
      });
      if (!ordersSnap.empty) await batch.commit();

      return NextResponse.json({ success: true, ordersRevoked: ordersSnap.size });
    }

    /**
     * Extends or grants course access by hand.
     *
     * Support previously had no way to fix a candidate's access without a
     * developer editing Firestore directly — so a webhook that never landed, or
     * a plan bought for the wrong course, needed an engineer.
     *
     * Extends from the CURRENT expiry when access is still live, and from today
     * when it has lapsed. Adding days to a date already in the past would hand
     * over an entitlement that is still expired.
     */
    if (action === 'extendAccess') {
      const days = Number(extraDays);
      if (!courseId) {
        return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
      }
      if (!Number.isFinite(days) || days < 1 || days > 3650) {
        return NextResponse.json({ error: 'Days must be between 1 and 3650.' }, { status: 400 });
      }

      const courseSnap = await adminDb.collection('courses').doc(courseId).get();
      if (!courseSnap.exists) {
        return NextResponse.json({ error: 'That course does not exist.' }, { status: 400 });
      }

      const userSnap = await targetRef.get();
      if (!userSnap.exists) {
        return NextResponse.json({ error: 'That user does not exist.' }, { status: 404 });
      }

      const existing = userSnap.data()?.enrolledCourses?.[courseId];
      const currentMs = existing?.expiresAt?.toMillis?.() ?? 0;
      const base = currentMs > Date.now() ? new Date(currentMs) : new Date();
      const expiresAt = new Date(base);
      expiresAt.setDate(expiresAt.getDate() + days);

      await targetRef.set({
        enrolledCourses: {
          [courseId]: {
            ...(existing ?? {}),
            expiresAt: Timestamp.fromDate(expiresAt),
            enrolledAt: existing?.enrolledAt ?? FieldValue.serverTimestamp(),
            // Marks this as staff-granted rather than paid for, so it is never
            // mistaken for revenue and can be found later.
            grantedBy: check.uid,
            grantedAt: FieldValue.serverTimestamp(),
            grantSource: 'admin',
          },
        },
      }, { merge: true });

      return NextResponse.json({
        success: true,
        expiresAt: expiresAt.toISOString(),
        extendedFrom: currentMs > Date.now() ? 'existing expiry' : 'today',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    console.error('Admin user-action error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
