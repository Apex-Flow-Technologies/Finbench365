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

    // 2. Look at the actual payment records, not just order.status. Razorpay
    // flips an order to 'attempted' as soon as a UPI QR/intent is generated —
    // before any money moves — so order.status alone cannot tell "opened the
    // UPI tab and changed their mind" apart from "money is genuinely in
    // flight". The payment records can.
    const paymentsRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
      headers: { 'Authorization': `Basic ${credentials}` },
    });
    const paymentItems: any[] = paymentsRes.ok ? (await paymentsRes.json()).items || [] : [];
    const capturedPayment = paymentItems.find((p) => p.status === 'captured');
    // Authorized = funds are held but not yet captured. This is the only
    // genuinely ambiguous state worth warning a candidate about.
    const authorizedPayment = paymentItems.find((p) => p.status === 'authorized');

    if (orderData.status === 'paid' || capturedPayment) {
      const paymentId = capturedPayment?.id ?? null;

      // We asked Razorpay directly, with our secret key, whether this order is
      // paid — that is a stronger signal than a client-supplied signature.
      // Grant entitlement right here server-side instead of round-tripping
      // through /verify (which requires a real Razorpay-issued signature the
      // client doesn't have in a reconciliation scenario).
      let granted = false;
      if (paymentId && notes.userId && notes.planId && notes.courseId && PLAN_PRICING[notes.planId]) {
        const planData = PLAN_PRICING[notes.planId];
        // Use what was actually captured. Rebuilding from the plan catalogue
        // ignores any discount, so a coupon order resolved through this path
        // would overstate revenue and permanently inflate the user's
        // totalSpent (it is incremented, not set).
        const capturedPaise = capturedPayment?.amount ?? orderData.amount_paid;
        const amountPaid = typeof capturedPaise === 'number'
          ? Math.round(capturedPaise) / 100
          : Math.round((planData.price * (1 + GST_RATE)) * 100) / 100;

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

    // Funds authorized but not yet captured — money has genuinely left the
    // candidate's side and will settle shortly. Worth telling them not to pay
    // again; the webhook grants access the moment capture lands.
    if (authorizedPayment) {
      return NextResponse.json({ status: 'authorized', orderId });
    }

    // Nothing captured, nothing authorized: either the checkout was merely
    // opened, or every attempt failed outright. Nothing is in flight, so the
    // candidate can simply try again with no warning.
    return NextResponse.json({
      status: orderData.status || 'unknown', // 'created' or 'attempted'
      orderId,
    });

  } catch (error: any) {
    console.error('Check order status error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
