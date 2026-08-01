import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { grantEntitlementIdempotent } from '@/lib/payments/grantEntitlement';

export async function POST(req: Request) {
  try {
    // Read raw body as text first (required for HMAC verification)
    const rawBody = await req.text();

    // Webhook Signature Verification — Prevents fake payment injections
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      console.error('RAZORPAY_WEBHOOK_SECRET is not set');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
    }

    if (!signature) {
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const providedBuf = Buffer.from(signature, 'utf8');
    const signatureValid = expectedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!signatureValid) {
      console.error('Webhook signature mismatch — rejecting payload');
      return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 });
    }

    const body = JSON.parse(rawBody);
    const event = body.event;

    if (event === 'payment.failed') {
      const paymentData = body.payload?.payment?.entity;
      console.error('Razorpay payment.failed webhook received:', paymentData?.id, paymentData?.error_description);
      return NextResponse.json({ success: true, note: 'logged failed payment' });
    }

    // Only payment.captured / order.paid guarantee funds are actually
    // captured. payment.authorized does NOT — for methods where auto-capture
    // is off, an authorized payment can still fail to capture, and there is
    // no revocation path, so it must not grant access.
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentData = body.payload?.payment?.entity;
      if (!paymentData) {
        return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
      }

      const { userId, planId, courseId } = paymentData.notes || {};
      const amountPaid = paymentData.amount ? paymentData.amount / 100 : 0; // paise -> rupees

      if (userId && planId && courseId) {
        try {
          const result = await grantEntitlementIdempotent({
            userId,
            planId,
            courseId,
            paymentId: paymentData.id,
            orderId: paymentData.order_id,
            amountPaid,
            source: 'webhook',
          });
          console.log(`Webhook entitlement ${result.granted ? 'granted' : 'already granted (idempotent skip)'}: userId=${userId}, courseId=${courseId}, orderId=${paymentData.order_id}`);
        } catch (grantErr) {
          console.error('Webhook entitlement grant failed:', grantErr);
          // Return 500 so Razorpay retries delivery — the grant is idempotent, so a retry is safe.
          return NextResponse.json({ error: 'Entitlement grant failed' }, { status: 500 });
        }
      } else {
        console.warn('Webhook received but missing userId/planId/courseId in notes:', paymentData.notes);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Razorpay Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
