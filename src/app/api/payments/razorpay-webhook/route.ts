import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
// import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Secure Webhook Verification (Uncomment when keys are added)
    // const signature = req.headers.get('x-razorpay-signature');
    // const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    // 
    // const expectedSignature = crypto.createHmac('sha256', secret!)
    //   .update(JSON.stringify(body))
    //   .digest('hex');
    //
    // if (signature !== expectedSignature) {
    //   return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 });
    // }

    const event = body.event;
    
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentData = body.payload.payment.entity;
      const { courseId, userId, durationDays } = paymentData.notes; // Metadata passed during order creation

      if (userId && courseId) {
        // Securely grant entitlement using Admin SDK, bypassing any client-side spoofing
        const userRef = adminDb.collection('users').doc(userId);
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays || '30', 10));
        
        await userRef.update({
          [`enrolledCourses.${courseId}`]: {
            expiresAt: adminDb.doc('users/1').firestore.Timestamp.fromDate(expiresAt),
            enrolledAt: adminDb.doc('users/1').firestore.FieldValue.serverTimestamp(),
            durationDays: parseInt(durationDays || '30', 10)
          }
        });
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Razorpay Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
