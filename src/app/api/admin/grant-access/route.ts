import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/api/requireAdmin';
import { rateLimit } from '@/lib/api/rateLimit';
import { recordAudit } from '@/lib/api/auditLog';
import { grantEntitlementIdempotent } from '@/lib/payments/grantEntitlement';
import { PLAN_PRICING } from '@/constants/pricing';

/**
 * Gives a student course access without a payment, or tops up what they have.
 *
 * Routes through grantEntitlementIdempotent rather than writing enrolledCourses
 * directly, so a manual grant produces the same order record, the same
 * idempotency guarantee and the same shape of data as a real purchase — which
 * keeps the admin ledger honest and means one code path owns entitlement.
 *
 * Recorded at amountPaid: 0 so it counts as comped, never as revenue.
 */
export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const limited = await rateLimit({
    scope: 'admin-grant', identifier: check.uid, limit: 60, windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many grants in a short period. Please wait.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }

  try {
    const { targetUserId, courseId, planId, mode, reason } = await req.json().catch(() => ({}));

    if (typeof targetUserId !== 'string' || !targetUserId) {
      return NextResponse.json({ error: 'Missing targetUserId.' }, { status: 400 });
    }
    if (typeof courseId !== 'string' || !courseId) {
      return NextResponse.json({ error: 'Missing courseId.' }, { status: 400 });
    }
    if (typeof planId !== 'string' || !PLAN_PRICING[planId]) {
      return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
    }
    const grantMode: 'grant' | 'extend' = mode === 'extend' ? 'extend' : 'grant';

    // Validate both ends exist before granting, so a typo can't produce access
    // to a course that isn't real or attach it to a non-existent user.
    const [userSnap, courseSnap] = await Promise.all([
      adminDb.collection('users').doc(targetUserId).get(),
      adminDb.collection('courses').doc(courseId).get(),
    ]);
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'That student does not exist.' }, { status: 404 });
    }
    if (!courseSnap.exists) {
      return NextResponse.json({ error: 'That course does not exist.' }, { status: 404 });
    }

    const orderId = `ADMIN-${randomUUID()}`;

    const result = await grantEntitlementIdempotent({
      userId: targetUserId,
      planId,
      courseId,
      paymentId: `admin_${check.uid}`,
      orderId,
      amountPaid: 0,          // comped — must never register as revenue
      source: 'admin',
      mode: grantMode,
      skipInvoiceEmail: true, // this is not a purchase; no receipt is due
    });

    await recordAudit({
      action: grantMode === 'extend' ? 'extend-access' : 'grant-access',
      actorUid: check.uid,
      targetUserId,
      details: {
        courseId,
        courseTitle: courseSnap.data()?.title,
        planId,
        durationDays: PLAN_PRICING[planId].durationDays,
        orderId,
        reason: typeof reason === 'string' ? reason.slice(0, 300) : undefined,
      },
    });

    return NextResponse.json({ success: true, orderId, granted: result.granted });
  } catch (error: any) {
    console.error('grant-access error:', error);
    return NextResponse.json({ error: 'Could not grant access.' }, { status: 500 });
  }
}
