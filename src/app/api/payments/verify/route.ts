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

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, planId, courseId } = await req.json();

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !planId || !courseId) {
      return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 });
    }

    const planData = PLAN_PRICING[planId];
    if (!planData) {
      return NextResponse.json({ error: 'Invalid planId provided during verification' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
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

    // Signature is genuine — grant entitlement idempotently (safe even if the
    // webhook already granted it for this order).
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
      error: error.message || 'Internal Server Error',
    }, { status: 500 });
  }
}
