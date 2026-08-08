import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/api/requireAdmin';

/**
 * Pulls refunds from Razorpay and reconciles them against our orders.
 *
 * Refunds issued directly in the Razorpay dashboard — which is how every refund
 * to date was done — never reached this system. The order stayed `success`, the
 * candidate kept their access, and the revenue figures counted money that had
 * been given back. Nothing in the app could have known: a dashboard refund
 * produces no webhook we subscribe to and no write here.
 *
 * This walks the refund list from the gateway and settles our records against
 * it. The gateway is the source of truth in this direction; we only ever mark
 * orders to match what it says.
 */

const RAZORPAY_API = 'https://api.razorpay.com/v1';
const PAGE = 100;

export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Payment gateway is not configured.' }, { status: 503 });
  }

  try {
    const { dryRun = true, revokeAccess = false } = await req.json().catch(() => ({}));
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    // ---- collect every refund the gateway knows about ----------------------
    const refunds: any[] = [];
    let skip = 0;
    // Bounded so a misconfigured account cannot spin here forever.
    for (let page = 0; page < 20; page++) {
      const res = await fetch(`${RAZORPAY_API}/refunds?count=${PAGE}&skip=${skip}`, {
        headers: { Authorization: `Basic ${credentials}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: body?.error?.description || `Razorpay returned ${res.status}` },
          { status: 502 },
        );
      }
      const body = await res.json();
      const items: any[] = body?.items ?? [];
      refunds.push(...items);
      if (items.length < PAGE) break;
      skip += PAGE;
    }

    // ---- match them to our orders -----------------------------------------
    // Indexed by paymentId: a refund names the payment it reverses, not the
    // order, and our orders carry the paymentId from the grant.
    const ordersSnap = await adminDb.collection('orders').get();
    const byPaymentId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    ordersSnap.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const pid = d.data()?.paymentId;
      if (pid) byPaymentId.set(pid, d);
    });

    const matched: any[] = [];
    const unmatched: any[] = [];

    for (const r of refunds) {
      const order = byPaymentId.get(r.payment_id);
      if (!order) {
        // A refund for a payment we have no order for — worth surfacing rather
        // than ignoring, since it usually means an order that never got written.
        unmatched.push({ refundId: r.id, paymentId: r.payment_id, amount: (r.amount ?? 0) / 100 });
        continue;
      }

      const data = order.data();
      const already = data.status === 'refunded' && data.refundId === r.id;
      matched.push({
        orderId: order.id,
        refundId: r.id,
        amount: (r.amount ?? 0) / 100,
        email: data.userEmail ?? null,
        alreadyRecorded: already,
        currentStatus: data.status,
      });
    }

    const toApply = matched.filter((m) => !m.alreadyRecorded);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        refundsAtGateway: refunds.length,
        alreadyRecorded: matched.length - toApply.length,
        willUpdate: toApply.length,
        unmatched,
        preview: toApply.slice(0, 50),
      });
    }

    // ---- write ------------------------------------------------------------
    let updated = 0;
    let accessRevoked = 0;

    for (const m of toApply) {
      const ref = adminDb.collection('orders').doc(m.orderId);
      const snap = await ref.get();
      const data = snap.data() ?? {};

      await ref.update({
        status: 'refunded',
        refundId: m.refundId,
        refundAmount: m.amount,
        refundedAt: FieldValue.serverTimestamp(),
        // Recorded so it is obvious this came from the gateway rather than from
        // someone pressing Refund in this admin panel.
        refundSource: 'razorpay-sync',
        refundedBy: check.uid,
      });
      updated++;

      // totalSpent is a running total of what a candidate actually paid, so a
      // refund has to come back off it or lifetime value stays overstated.
      if (data.userId && typeof data.amountPaid === 'number' && data.amountPaid > 0) {
        await adminDb.collection('users').doc(data.userId)
          .update({ totalSpent: FieldValue.increment(-data.amountPaid) })
          .catch(() => {});
      }

      // Off by default. A refund handled outside this system may already have
      // been settled with the candidate some other way, and silently pulling
      // course access from someone mid-preparation is not a decision to make
      // on their behalf without being asked.
      if (revokeAccess && data.userId && data.courseId) {
        await adminDb.collection('users').doc(data.userId)
          .update({ [`enrolledCourses.${data.courseId}`]: FieldValue.delete() })
          .then(() => { accessRevoked++; })
          .catch(() => {});
      }
    }

    console.log(`Refund sync by ${check.uid}: ${updated} orders updated, ${accessRevoked} access revoked.`);

    return NextResponse.json({
      success: true,
      refundsAtGateway: refunds.length,
      ordersUpdated: updated,
      accessRevoked,
      unmatched,
    });
  } catch (error: any) {
    console.error('Refund sync error:', error);
    return NextResponse.json({ error: 'Refund sync failed.' }, { status: 500 });
  }
}
