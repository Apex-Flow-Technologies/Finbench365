import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

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
    } catch (err) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { planId, price, courseId, durationDays } = body;

    if (!planId || !price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof price !== 'number' || price <= 0) {
      return NextResponse.json({ error: 'Invalid price value' }, { status: 400 });
    }

    // Validate Razorpay keys are configured
    // Validating Razorpay keys
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay keys not configured');
      return NextResponse.json({ error: 'Payment gateway not configured. Please contact support.' }, { status: 503 });
    }

    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: Math.round(price * 100), // Convert to paise (INR smallest unit)
      currency: 'INR',
      receipt: `rcpt_${decodedToken.uid}_${Date.now()}`,
      notes: {
        courseId: courseId || planId,
        userId: decodedToken.uid,
        durationDays: String(durationDays || 30),
        planId,
      },
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({ success: true, order });

  } catch (error: any) {
    console.error('Create Order API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

