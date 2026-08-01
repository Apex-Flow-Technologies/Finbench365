import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { PLAN_PRICING, GST_RATE } from '@/constants/pricing';
import crypto from 'crypto';
import { grantEntitlementIdempotent } from '@/lib/payments/grantEntitlement';

export async function POST(req: Request) {
  try {
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

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = await req.json();

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const providedBuf = Buffer.from(String(razorpay_signature), 'utf8');
    const signatureValid = expectedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!signatureValid) {
      console.error('Payment signature mismatch — possible fraud attempt. orderId:', razorpay_order_id);
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    // The signature only proves this payment_id/order_id pair is genuine — it
    // says nothing about which plan/course it was for. Fetch the order from
    // Razorpay directly and use ITS notes (set server-side in create-order)
    // as the source of truth, never client-supplied planId/courseId, which
    // would otherwise let a caller pay for a cheap plan and request an
    // expensive one in the same request.
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { 'Authorization': `Basic ${credentials}` },
    });

    if (!orderRes.ok) {
      console.error('Could not fetch order during verify:', orderRes.status);
      return NextResponse.json({ error: 'Could not verify order' }, { status: 502 });
    }

    const orderData = await orderRes.json();
    const notes = orderData.notes || {};

    if (notes.userId !== decodedToken.uid) {
      console.error('Verify ownership mismatch. order userId:', notes.userId, 'caller:', decodedToken.uid);
      return NextResponse.json({ error: 'Order does not belong to this user' }, { status: 403 });
    }

    // A valid signature can exist for an order that later ends up merely
    // authorized rather than captured — Razorpay only marks the order
    // 'paid' once a payment against it is actually captured, so require
    // that here rather than trusting the signature alone.
    if (orderData.status !== 'paid') {
      console.error('Verify called for a non-captured order. status:', orderData.status, 'orderId:', razorpay_order_id);
      return NextResponse.json({ error: 'Payment not yet captured' }, { status: 409 });
    }

    const planId = notes.planId;
    const courseId = notes.courseId;
    const planData = PLAN_PRICING[planId];
    if (!planId || !courseId || !planData) {
      return NextResponse.json({ error: 'Order is missing required metadata' }, { status: 400 });
    }

    const basePrice = planData.price;
    const gstAmount = Math.round((basePrice * GST_RATE) * 100) / 100;
    const amountPaid = Math.round((basePrice + gstAmount) * 100) / 100;

    const result = await grantEntitlementIdempotent({
      userId: decodedToken.uid,
      planId,
      courseId,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      amountPaid,
      source: 'verify',
    });

    console.log(`Course access ${result.granted ? 'granted' : 'already granted'}: userId=${decodedToken.uid}, courseId=${courseId}, orderId=${razorpay_order_id}`);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Payment verify error:', error);
    return NextResponse.json({
      error: 'Internal Server Error',
    }, { status: 500 });
  }
}
