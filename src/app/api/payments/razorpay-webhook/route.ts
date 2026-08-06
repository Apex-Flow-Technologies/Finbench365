import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { grantEntitlementIdempotent } from '@/lib/payments/grantEntitlement';

interface OrderNotes {
  userId?: string;
  planId?: string;
  courseId?: string;
}

const hasAllNotes = (n: OrderNotes | undefined | null): boolean =>
  Boolean(n?.userId && n?.planId && n?.courseId);

/**
 * Reads the notes back off the order at Razorpay.
 *
 * create-order sets userId/planId/courseId as notes on the ORDER. Razorpay does
 * not reliably copy those onto the payment entity, and when it doesn't the
 * webhook has nothing to identify the buyer with — it used to log a warning and
 * grant nothing, leaving the manual reconcile sweep as the only way anyone would
 * ever get the access they paid for.
 */
async function fetchOrderNotes(orderId: string): Promise<OrderNotes | null> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !orderId) return null;

  try {
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    if (!res.ok) {
      console.error(`Webhook could not fetch order ${orderId}:`, res.status);
      return null;
    }
    return (await res.json())?.notes ?? null;
  } catch (err) {
    console.error(`Webhook order fetch threw for ${orderId}:`, err);
    return null;
  }
}

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

      const amountPaid = paymentData.amount ? paymentData.amount / 100 : 0; // paise -> rupees

      // Three sources, cheapest first: the payment entity, then the order
      // entity that rides along in an `order.paid` payload, then a direct call
      // to the Razorpay API. Only the last costs a round trip, and only when
      // the first two came up empty.
      let notes: OrderNotes = paymentData.notes || {};
      if (!hasAllNotes(notes)) {
        const embeddedOrderNotes: OrderNotes | undefined = body.payload?.order?.entity?.notes;
        if (hasAllNotes(embeddedOrderNotes)) {
          notes = embeddedOrderNotes!;
        } else {
          const fetched = await fetchOrderNotes(paymentData.order_id);
          if (hasAllNotes(fetched)) notes = fetched!;
        }
      }

      const { userId, planId, courseId } = notes;

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
        // All three sources came up empty. Money has been captured against an
        // order we cannot attribute, so answer 500: Razorpay retries, the grant
        // is idempotent so retrying is free, and a transient failure of the
        // order fetch above gets more chances. Answering 200 here would tell
        // Razorpay this was handled and strand the payment until someone
        // noticed it in the reconcile sweep.
        console.error(
          'Webhook could not resolve userId/planId/courseId for a captured payment.',
          { paymentId: paymentData.id, orderId: paymentData.order_id, paymentNotes: paymentData.notes },
        );
        return NextResponse.json({ error: 'Could not resolve order metadata' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Razorpay Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
