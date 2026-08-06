import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { PLAN_PRICING, GST_RATE } from '@/constants/pricing';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { grantEntitlementIdempotent } from '@/lib/payments/grantEntitlement';
import { evaluateCoupon, normaliseCouponCode } from '@/lib/payments/coupons';

// How long a just-created Razorpay order is considered "still in progress" —
// past this, create-order will start a fresh order instead of trying to reuse it.
const PENDING_ORDER_TTL_MS = 15 * 60 * 1000;

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

    const userId = decodedToken.uid;

    const body = await req.json();
    const { planId, courseId, couponCode } = body;

    if (!planId || !PLAN_PRICING[planId]) {
      return NextResponse.json({ error: 'Invalid or missing planId' }, { status: 400 });
    }

    if (!courseId) {
      return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
    }

    // Validate courseId against the real catalog before creating any order or
    // writing it into enrolledCourses later.
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: 'Course not found' }, { status: 400 });
    }

    const userSnap = await adminDb.collection('users').doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : null;

    if (userData?.suspended) {
      return NextResponse.json({ error: 'Your account is suspended. Contact support.' }, { status: 403 });
    }

    const planData = PLAN_PRICING[planId];
    const basePrice = planData.price;
    let discountPercent = 0;
    let appliedCouponCode: string | null = null;

    // Server-side coupon validation. This only READS — `usedCount` is
    // incremented in grantEntitlementIdempotent, when the order actually
    // transitions to paid. Incrementing here meant every abandoned checkout
    // burned a use of a maxUses-limited coupon.
    //
    // The rules live in lib/payments/coupons.ts, shared with /validate-coupon,
    // so what the candidate is told in the order summary and what they are
    // charged at the gateway cannot drift apart.
    if (couponCode && typeof couponCode === 'string') {
      const sanitizedCode = normaliseCouponCode(couponCode);
      const couponSnap = await adminDb.collection('coupons').doc(sanitizedCode).get();
      const evaluation = evaluateCoupon(couponSnap.exists ? couponSnap.data()! : null);

      if (evaluation.valid) {
        discountPercent = evaluation.discountPercent;
        appliedCouponCode = sanitizedCode;
      }
    }

    // Secure server-side price calculation
    const discountedPrice = basePrice * (1 - discountPercent / 100);
    const gstAmount = Math.round((discountedPrice * GST_RATE) * 100) / 100;
    const finalTotal = Math.round((discountedPrice + gstAmount) * 100) / 100;

    if (finalTotal <= 0) {
      // 100% discount — no gateway round trip. This still routes through the
      // shared entitlement path rather than writing enrolledCourses directly,
      // so a free enrolment gets the same confirmation email, the same order
      // record shape, and the same idempotency guarantee as a paid one. It
      // previously wrote its own copy of that logic and therefore never sent
      // the candidate any confirmation at all.
      const orderId = `BYPASS-${randomUUID()}`;

      const result = await grantEntitlementIdempotent({
        userId,
        planId,
        courseId,
        paymentId: `coupon_${appliedCouponCode ?? 'FREE'}`,
        orderId,
        amountPaid: 0,
        source: 'coupon',
        // No order document exists for a bypass, so the code cannot be read
        // back off one — it has to be handed over for the usage increment.
        couponCode: appliedCouponCode,
      });

      return NextResponse.json({
        success: true,
        bypassed: true,
        orderId,
        granted: result.granted || result.alreadyProcessed,
      });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Razorpay keys not configured');
      return NextResponse.json({ error: 'Payment gateway not configured.' }, { status: 503 });
    }

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    // Server-side duplicate-order prevention: if this user already has a
    // recent, unresolved order for this course, reuse it instead of opening
    // a second live Razorpay order (avoids doubling checkout.js's polling
    // load and avoids the user racking up multiple abandoned orders).
    //
    // The reuse test must include the PRICE, not just the course. Matching on
    // courseId alone meant this sequence charged the wrong amount:
    //   1. open checkout, click Pay with no coupon  -> order created at Rs 706.82
    //   2. close the Razorpay popup (order stays 'created'/'attempted')
    //   3. apply a coupon, click Pay again
    //   4. the coupon validates, a discounted total is computed... and then this
    //      branch returned the ORIGINAL Rs 706.82 order, so Razorpay showed the
    //      undiscounted amount and the discount was silently thrown away.
    // The same fault in reverse would honour a coupon the candidate had removed.
    const amountPaise = Math.round(finalTotal * 100);
    const pending = userData?.pendingOrder;
    if (
      pending &&
      pending.courseId === courseId &&
      pending.planId === planId &&
      pending.amountPaise === amountPaise &&
      (pending.couponCode ?? null) === (appliedCouponCode ?? null) &&
      pending.createdAtMs &&
      Date.now() - pending.createdAtMs < PENDING_ORDER_TTL_MS
    ) {
      const existingRes = await fetch(`https://api.razorpay.com/v1/orders/${pending.orderId}`, {
        headers: { 'Authorization': `Basic ${credentials}` },
      });
      if (existingRes.ok) {
        const existingOrder = await existingRes.json();
        if (existingOrder.status === 'created' || existingOrder.status === 'attempted') {
          return NextResponse.json({ success: true, order: existingOrder });
        }
        // If it's already 'paid', fall through — verify/reconcile will catch it;
        // for any other terminal state, fall through to create a fresh order.
      }
    }

    // Call Razorpay REST API directly
    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `rcpt_${userId}_${Date.now()}`.slice(0, 40),
        notes: {
          planId: planId,
          courseId: courseId,
          userId: userId,
        },
      }),
    });

    const order = await razorpayRes.json();

    if (!razorpayRes.ok) {
      console.error('Razorpay API error:', order);
      return NextResponse.json({ error: order?.error?.description || 'Failed to create Razorpay order' }, { status: 500 });
    }

    // Track this as the user's active pending order (dedup pointer) and
    // record it in orders/ for reconciliation visibility.
    await adminDb.collection('users').doc(userId).set({
      pendingOrder: {
        orderId: order.id,
        courseId,
        planId,
        // Recorded so the reuse test above can tell "same checkout, retried"
        // apart from "same course, different price after a coupon changed".
        amountPaise,
        couponCode: appliedCouponCode ?? null,
        createdAtMs: Date.now(),
      },
    }, { merge: true });

    await adminDb.collection('orders').doc(order.id).set({
      userId,
      // Denormalised so the admin orders list needs no per-row user lookup.
      // That lookup was an N+1 and fell back to "Unknown User" whenever the
      // user document was incomplete.
      userEmail: decodedToken.email || userData?.email || '',
      courseId,
      planId,
      orderId: order.id,
      // `amount` kept for backwards compatibility with existing documents.
      // The explicit trio below removes the ambiguity that made the admin
      // revenue figure irreconcilable: `amount` was ex-GST while the user's
      // totalSpent accumulated incl-GST, so the two could never agree.
      amount: planData.price,
      amountBase: Math.round(discountedPrice * 100) / 100, // ex-GST, post-discount
      gstAmount,
      amountPaid: finalTotal,                              // incl-GST, what is charged
      couponCode: appliedCouponCode,
      status: 'created',
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ success: true, order });

  } catch (error: any) {
    console.error('Create Order API Error:', error);
    return NextResponse.json({
      error: 'Internal Server Error',
    }, { status: 500 });
  }
}
