import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { PLAN_PRICING } from '@/constants/pricing';

export async function POST(req: Request) {
  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json();
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    // 1. Fetch the order from Razorpay
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { 'Authorization': `Basic ${credentials}` },
    });

    if (!orderRes.ok) {
      console.error('Razorpay order fetch failed:', orderRes.status);
      return NextResponse.json({ status: 'unknown', error: 'Could not fetch order status' }, { status: 502 });
    }

    const orderData = await orderRes.json();

    // order.status can be: created | attempted | paid
    if (orderData.status === 'paid') {
      // 2. Fetch the payments for this order to get payment_id
      const paymentsRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
        headers: { 'Authorization': `Basic ${credentials}` },
      });

      let paymentId = null;
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        // Find the captured/authorized payment
        const successfulPayment = paymentsData.items?.find(
          (p: any) => p.status === 'captured' || p.status === 'authorized'
        );
        if (successfulPayment) {
          paymentId = successfulPayment.id;
        }
      }

      return NextResponse.json({
        status: 'paid',
        paymentId,
        orderId,
        notes: orderData.notes || {},
      });
    }

    // Not paid yet
    return NextResponse.json({
      status: orderData.status || 'unknown', // 'created' or 'attempted'
      orderId,
    });

  } catch (error: any) {
    console.error('Check order status error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
