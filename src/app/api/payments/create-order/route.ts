import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { PLAN_PRICING, GST_RATE } from '@/constants/pricing';

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
    const { planId, courseId, couponCode } = body;

    if (!planId || !PLAN_PRICING[planId]) {
      return NextResponse.json({ error: 'Invalid or missing planId' }, { status: 400 });
    }
    
    if (!courseId) {
      return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
    }

    const planData = PLAN_PRICING[planId];
    let basePrice = planData.price;
    let discountPercent = 0;

    // Secure server-side coupon validation
    if (couponCode && typeof couponCode === 'string') {
      const sanitizedCode = couponCode.trim().toUpperCase();
      const couponDoc = await adminDb.collection('coupons').doc(sanitizedCode).get();
      
      if (couponDoc.exists) {
        const couponData = couponDoc.data()!;
        if (couponData.isActive && (!couponData.maxUses || couponData.usedCount < couponData.maxUses)) {
          discountPercent = couponData.discountPercent || 0;
        }
      }
    }

    // Secure server-side price calculation
    const discountedPrice = basePrice * (1 - discountPercent / 100);
    const gstAmount = Math.round((discountedPrice * GST_RATE) * 100) / 100;
    const finalTotal = Math.round((discountedPrice + gstAmount) * 100) / 100;

    if (finalTotal <= 0) {
      return NextResponse.json({ error: 'Calculated price is zero or invalid' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Razorpay keys not configured');
      return NextResponse.json({ error: 'Payment gateway not configured.' }, { status: 503 });
    }

    // Call Razorpay REST API directly
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(finalTotal * 100), // paise
        currency: 'INR',
        receipt: `rcpt_${decodedToken.uid}_${Date.now()}`.slice(0, 40),
        notes: {
          planId: planId,
          courseId: courseId,
          userId: decodedToken.uid,
          // Removed spoofable courseId and durationDays. 
          // The verify endpoint will look these up natively using planId.
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
