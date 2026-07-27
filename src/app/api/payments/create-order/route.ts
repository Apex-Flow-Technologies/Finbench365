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
    } catch (err: any) {
      console.error('Token verification failed:', err.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { planId, price, courseId, durationDays } = body;

    if (!planId || price === undefined || price === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return NextResponse.json({ error: 'Invalid price value' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Razorpay keys not configured');
      return NextResponse.json({ error: 'Payment gateway not configured.' }, { status: 503 });
    }

    // Call Razorpay REST API directly — no npm package needed
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(numericPrice * 100), // paise
        currency: 'INR',
        receipt: `rcpt_${decodedToken.uid}_${Date.now()}`.slice(0, 40),
        notes: {
          courseId: String(courseId || planId),
          userId: decodedToken.uid,
          durationDays: String(durationDays || 30),
          planId: String(planId),
        },
      }),
    });

    const order = await razorpayRes.json();

    if (!razorpayRes.ok) {
      console.error('Razorpay API error:', order);
      return NextResponse.json({ error: order?.error?.description || 'Failed to create Razorpay order' }, { status: 500 });
    }

    return NextResponse.json({ success: true, order });

  } catch (error: any) {
    console.error('Create Order API Error:', error);
    return NextResponse.json({
      error: error.message || 'Internal Server Error',
    }, { status: 500 });
  }
}
