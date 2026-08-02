import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { PLAN_PRICING, GST_RATE } from '@/constants/pricing';
import { requireAdmin } from '@/lib/api/requireAdmin';
import { grantEntitlementIdempotent } from '@/lib/payments/grantEntitlement';

// Only bother checking orders that have had time to resolve naturally
// (webhook delivery, client verify, or the checkout page's own reconciliation).
const STALE_THRESHOLD_MS = 15 * 60 * 1000;
const MAX_ORDERS_PER_RUN = 50;

/**
 * Admin-triggered reconciliation: finds Firestore orders stuck in 'created'
 * (never resolved to 'success' or a terminal Razorpay state) and asks
 * Razorpay directly what actually happened. This is the manual safety net
 * for "captured at Razorpay, missing in Firestore" — the scenario that
 * started this whole audit.
 */
export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 });
  }
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  try {
    const cutoff = Date.now() - STALE_THRESHOLD_MS;
    // The staleness filter belongs in the query, not the loop. Applying
    // .limit() first meant a burst of fresh 'created' orders could fill the
    // whole page and crowd out the genuinely stuck ones this sweep exists to
    // heal. Requires the composite index on (status, createdAt).
    const stuckSnap = await adminDb.collection('orders')
      .where('status', '==', 'created')
      .where('createdAt', '<', Timestamp.fromMillis(cutoff))
      .orderBy('createdAt', 'asc')
      .limit(MAX_ORDERS_PER_RUN)
      .get();

    const results: any[] = [];

    for (const doc of stuckSnap.docs) {
      const order = doc.data();

      try {
        const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${order.orderId}`, {
          headers: { 'Authorization': `Basic ${credentials}` },
        });
        if (!orderRes.ok) {
          results.push({ orderId: order.orderId, outcome: 'razorpay-fetch-failed' });
          continue;
        }
        const orderData = await orderRes.json();

        if (orderData.status !== 'paid') {
          results.push({ orderId: order.orderId, outcome: 'not-paid', razorpayStatus: orderData.status });
          continue;
        }

        const paymentsRes = await fetch(`https://api.razorpay.com/v1/orders/${order.orderId}/payments`, {
          headers: { 'Authorization': `Basic ${credentials}` },
        });
        const paymentsData = paymentsRes.ok ? await paymentsRes.json() : { items: [] };
        const captured = paymentsData.items?.find((p: any) => p.status === 'captured');

        if (!captured) {
          results.push({ orderId: order.orderId, outcome: 'paid-but-no-captured-payment-found' });
          continue;
        }

        const notes = orderData.notes || {};
        if (!notes.userId || !notes.planId || !notes.courseId || !PLAN_PRICING[notes.planId]) {
          results.push({ orderId: order.orderId, outcome: 'missing-notes', notes });
          continue;
        }

        const planData = PLAN_PRICING[notes.planId];
        const gstAmount = Math.round((planData.price * GST_RATE) * 100) / 100;
        const amountPaid = Math.round((planData.price + gstAmount) * 100) / 100;

        const grantResult = await grantEntitlementIdempotent({
          userId: notes.userId,
          planId: notes.planId,
          courseId: notes.courseId,
          paymentId: captured.id,
          orderId: order.orderId,
          amountPaid,
          source: 'reconcile',
        });

        results.push({
          orderId: order.orderId,
          outcome: grantResult.granted ? 'healed-and-granted' : 'already-granted',
          userId: notes.userId,
          courseId: notes.courseId,
        });
      } catch (err: any) {
        results.push({ orderId: order.orderId, outcome: 'error', error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      scanned: stuckSnap.size,
      processed: results.length,
      results,
    });

  } catch (error: any) {
    console.error('Reconcile orders error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
