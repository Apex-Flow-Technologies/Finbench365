import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { PLAN_PRICING, GST_RATE } from '@/constants/pricing';
import { grantEntitlementIdempotent } from '@/lib/payments/grantEntitlement';

export async function POST(req: Request) {
  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json();
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    // 1. Fetch the order from Razorpay directly (source of truth — not client-supplied data)
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { 'Authorization': `Basic ${credentials}` },
    });

    if (!orderRes.ok) {
      console.error('Razorpay order fetch failed:', orderRes.status);
      // A 4xx here means Razorpay doesn't recognize this order id at all under
      // the currently configured key — e.g. the order was created under a
      // different key/mode (live vs test) before switching. That's a clean
      // signal nothing is pending under the current gateway, unlike a
      // 5xx/network failure where a payment could genuinely be in flight — so
      // it's safe to tell the client to drop it instead of the client being
      // stuck showing "do not pay again" forever.
      if (orderRes.status >= 400 && orderRes.status < 500) {
        return NextResponse.json({ status: 'not-found', orderId });
      }
      return NextResponse.json({ status: 'unknown', error: 'Could not fetch order status' }, { status: 502 });
    }

    const orderData = await orderRes.json();
    const notes = orderData.notes || {};

    // Ownership check — this order must belong to the authenticated caller.
    // Without this, any logged-in user could probe another user's order/payment status.
    if (notes.userId && notes.userId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // order.status can be: created | attempted | paid
    if (orderData.status === 'paid') {
      // 2. Fetch the payments for this order to get payment_id
      const paymentsRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
        headers: { 'Authorization': `Basic ${credentials}` },
      });

      let paymentId = null;
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        const successfulPayment = paymentsData.items?.find(
          (p: any) => p.status === 'captured'
        );
        if (successfulPayment) {
          paymentId = successfulPayment.id;
        }
      }

      // We asked Razorpay directly, with our secret key, whether this order is
      // paid — that is a stronger signal than a client-supplied signature.
      // Grant entitlement right here server-side instead of round-tripping
      // through /verify (which requires a real Razorpay-issued signature the
      // client doesn't have in a reconciliation scenario).
      let granted = false;
      if (paymentId && notes.userId && notes.planId && notes.courseId && PLAN_PRICING[notes.planId]) {
        const planData = PLAN_PRICING[notes.planId];
        const gstAmount = Math.round((planData.price * GST_RATE) * 100) / 100;
        const amountPaid = Math.round((planData.price + gstAmount) * 100) / 100;

        const result = await grantEntitlementIdempotent({
          userId: notes.userId,
          planId: notes.planId,
          courseId: notes.courseId,
          paymentId,
          orderId,
          amountPaid,
          source: 'reconcile',
        });
        granted = result.granted || result.alreadyProcessed;
      }

      return NextResponse.json({
        status: 'paid',
        paymentId,
        orderId,
        granted,
        notes,
      });
    }

    // Not paid yet
    return NextResponse.json({
      status: orderData.status || 'unknown', // 'created' or 'attempted'
      orderId,
    });

  } catch (error: any) {
    console.error('Check order status error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
