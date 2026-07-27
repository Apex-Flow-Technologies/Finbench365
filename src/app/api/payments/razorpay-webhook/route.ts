import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

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

    if (signature !== expectedSignature) {
      console.warn('Razorpay webhook signature mismatch — possible spoofing attempt');
      return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 });
    }

    const body = JSON.parse(rawBody);
    const event = body.event;

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentData = body.payload?.payment?.entity;
      if (!paymentData) {
        return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
      }

      const { courseId, userId, durationDays, planId } = paymentData.notes || {};
      const amountPaid = paymentData.amount ? paymentData.amount / 100 : 0; // Convert from paise

      if (userId && courseId) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays || '30', 10));

        const userRef = adminDb.collection('users').doc(userId);

        // Grant entitlement and track revenue atomically
        await userRef.update({
          [`enrolledCourses.${courseId}`]: {
            expiresAt: Timestamp.fromDate(expiresAt),
            enrolledAt: FieldValue.serverTimestamp(),
            durationDays: parseInt(durationDays || '30', 10),
            planId: planId || courseId,
            paymentId: paymentData.id,
          },
          totalSpent: FieldValue.increment(amountPaid),
          lastPaymentAt: FieldValue.serverTimestamp(),
        });

        console.log(`Entitlement granted: userId=${userId}, courseId=${courseId}, durationDays=${durationDays}`);
      } else {
        console.warn('Webhook received but missing userId or courseId in notes:', paymentData.notes);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Razorpay Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

