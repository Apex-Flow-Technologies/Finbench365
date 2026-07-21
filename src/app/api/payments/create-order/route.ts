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
    const { planId, price } = body;

    if (!planId || !price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // TODO: Initialize Razorpay instance
    // const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    
    // const options = {
    //   amount: price * 100, // amount in smallest currency unit
    //   currency: "INR",
    //   receipt: `receipt_${Date.now()}`
    // };
    // const order = await razorpay.orders.create(options);

    // Mocking Razorpay Order Creation for now until keys are provided
    const order = {
      id: `order_${Math.random().toString(36).substring(2, 15)}`,
      amount: price * 100,
      currency: "INR"
    };

    return NextResponse.json({ success: true, order });

  } catch (error: any) {
    console.error('Create Order API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
