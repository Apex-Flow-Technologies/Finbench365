import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { PLAN_PRICING } from '@/constants/pricing';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { sendInvoiceEmail } from '@/lib/email';
import { GST_RATE } from '@/constants/pricing';

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
      console.error('Webhook signature mismatch — expected:', expectedSignature, 'got:', signature);
      return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 });
    }

    const body = JSON.parse(rawBody);
    const event = body.event;

    if (event === 'payment.failed') {
      const paymentData = body.payload?.payment?.entity;
      console.error('Razorpay payment.failed webhook received:', paymentData?.id, paymentData?.error_description);
      return NextResponse.json({ success: true, note: 'logged failed payment' });
    }

    if (event === 'payment.captured' || event === 'order.paid' || event === 'payment.authorized') {
      const paymentData = body.payload?.payment?.entity;
      if (!paymentData) {
        return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
      }

      const { userId, planId, courseId } = paymentData.notes || {};
      const amountPaid = paymentData.amount ? paymentData.amount / 100 : 0; // Convert from paise

      if (userId && planId && courseId && PLAN_PRICING[planId]) {
        const planData = PLAN_PRICING[planId];
        const days = planData.durationDays;
        const effectiveCourseId = courseId;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);

        const userRef = adminDb.collection('users').doc(userId);

        // Grant entitlement and track revenue atomically (use set with merge to avoid not-found errors)
        await userRef.set({
          enrolledCourses: {
            [effectiveCourseId]: {
              expiresAt: Timestamp.fromDate(expiresAt),
              enrolledAt: FieldValue.serverTimestamp(),
              durationDays: days,
              planId: planId,
              paymentId: paymentData.id,
            }
          },
          totalSpent: FieldValue.increment(amountPaid),
          lastPaymentAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`Webhook entitlement granted: userId=${userId}, courseId=${effectiveCourseId}, durationDays=${days}`);
        
        // Dispatch Invoice Email
        try {
          const userRecord = await adminAuth.getUser(userId);
          if (userRecord.email) {
            const courseDoc = await adminDb.collection('courses').doc(effectiveCourseId).get();
            const courseTitle = courseDoc.exists ? courseDoc.data()?.title : 'Certification Track';
            
            const basePrice = planData.price;
            const gstAmount = basePrice * GST_RATE;
            
            await sendInvoiceEmail({
              email: userRecord.email,
              name: userRecord.displayName || 'Candidate',
              courseTitle: courseTitle,
              planName: planData.name,
              orderId: paymentData.order_id || paymentData.id,
              amount: basePrice,
              gstAmount: gstAmount,
              total: amountPaid,
            });
          }
        } catch (emailErr) {
          console.error('Failed to send invoice email from webhook:', emailErr);
          // Do not throw, webhook should still return 200 OK
        }

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

