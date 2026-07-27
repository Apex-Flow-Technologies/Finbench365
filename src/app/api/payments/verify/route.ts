import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

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
    } catch (err: any) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, courseId, durationDays, planId } = await req.json();

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 });
    }

    // Verify the payment signature using Razorpay's standard method
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('Payment signature mismatch — possible fraud attempt');
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    // Payment is verified — grant course access
    const userId = decodedToken.uid;
    const days = parseInt(String(durationDays || 30), 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const effectiveCourseId = courseId || planId || 'unknown';
    const userRef = adminDb.collection('users').doc(userId);

    // We use set with merge: true and a nested object so it creates the user document if it doesn't exist
    await userRef.set({
      enrolledCourses: {
        [effectiveCourseId]: {
          expiresAt: Timestamp.fromDate(expiresAt),
          enrolledAt: FieldValue.serverTimestamp(),
          durationDays: days,
          planId: planId || effectiveCourseId,
          paymentId: razorpay_payment_id,
        }
      },
      lastPaymentAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`Course access granted: userId=${userId}, courseId=${effectiveCourseId}`);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Payment verify error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error',
      debug: {
        code: error.code,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.substring(0, 20) + '...',
      }
    }, { status: 500 });
  }
}
