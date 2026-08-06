import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/api/requireAdmin';

type Action = 'suspend' | 'activate' | 'revokeCourse' | 'demote';

export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const { action, targetUserId, courseId } = await req.json() as {
      action: Action;
      targetUserId: string;
      courseId?: string;
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

      // Best-effort: mark any matching order(s) as refunded for audit trail.
      const ordersSnap = await adminDb.collection('orders')
        .where('userId', '==', targetUserId)
        .where('courseId', '==', courseId)
        .where('status', '==', 'success')
        .get();
      const batch = adminDb.batch();
      ordersSnap.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        batch.update(doc.ref, { status: 'refunded', refundedAt: FieldValue.serverTimestamp(), refundedBy: check.uid });
      });
      if (!ordersSnap.empty) await batch.commit();

      return NextResponse.json({ success: true, ordersMarkedRefunded: ordersSnap.size });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    console.error('Admin user-action error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
