import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/api/requireAdmin';
import { recordAudit } from '@/lib/api/auditLog';

type Action = 'suspend' | 'activate' | 'revokeCourse' | 'setRole';

export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const { action, targetUserId, courseId, role } = await req.json() as {
      action: Action;
      targetUserId: string;
      courseId?: string;
      role?: 'student' | 'admin';
    };

    if (!action || !targetUserId) {
      return NextResponse.json({ error: 'Missing action or targetUserId' }, { status: 400 });
    }

    const targetRef = adminDb.collection('users').doc(targetUserId);

    if (action === 'suspend' || action === 'activate') {
      const suspending = action === 'suspend';

      // An admin suspending themselves would immediately lock them out of the
      // panel with no way back except a database edit.
      if (suspending && targetUserId === check.uid) {
        return NextResponse.json({ error: 'You cannot suspend your own account.' }, { status: 400 });
      }

      await targetRef.set({
        suspended: suspending,
        ...(suspending
          ? { suspendedAt: FieldValue.serverTimestamp(), suspendedBy: check.uid }
          : { reactivatedAt: FieldValue.serverTimestamp(), reactivatedBy: check.uid }),
      }, { merge: true });

      await recordAudit({
        action: suspending ? 'suspend-user' : 'activate-user',
        actorUid: check.uid,
        targetUserId,
      });
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

      await recordAudit({
        action: 'revoke-access',
        actorUid: check.uid,
        targetUserId,
        details: { courseId, ordersMarkedRefunded: ordersSnap.size },
      });

      return NextResponse.json({ success: true, ordersMarkedRefunded: ordersSnap.size });
    }

    if (action === 'setRole') {
      // Role changes were previously a direct client Firestore write, which
      // left no record of who made the change. Server-side so it is audited.
      if (role !== 'student' && role !== 'admin') {
        return NextResponse.json({ error: 'Role must be student or admin.' }, { status: 400 });
      }
      // Demoting yourself would immediately revoke your own admin panel access.
      if (targetUserId === check.uid && role !== 'admin') {
        return NextResponse.json({ error: 'You cannot remove your own admin access.' }, { status: 400 });
      }

      await targetRef.set({ role, roleUpdatedAt: FieldValue.serverTimestamp(), roleUpdatedBy: check.uid }, { merge: true });
      await recordAudit({ action: 'set-role', actorUid: check.uid, targetUserId, details: { role } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    console.error('Admin user-action error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
