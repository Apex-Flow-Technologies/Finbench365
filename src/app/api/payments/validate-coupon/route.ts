import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { rateLimit, clientIp } from '@/lib/api/rateLimit';
import {
  evaluateCoupon, normaliseCouponCode, couponRejectionMessage,
} from '@/lib/payments/coupons';

/**
 * Checks whether a coupon can be applied, for the checkout order summary.
 *
 * Authenticated and durably rate-limited. This endpoint used to be open to
 * anyone with no token and only the in-memory middleware limiter in front of it
 * — which the limiter's own comments describe as per-instance and reset on cold
 * start, so it was no obstacle to a script. That made this a free oracle over
 * the whole coupon namespace, and a 100%-off code is free course access.
 *
 * Note this endpoint is advisory only: nothing here grants a discount. The
 * authoritative evaluation happens again inside create-order, against the same
 * shared rules in lib/payments/coupons.ts.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ valid: false, message: 'Please sign in to apply a coupon.' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
      return NextResponse.json({ valid: false, message: 'Please sign in to apply a coupon.' }, { status: 401 });
    }

    // Per-account and per-IP. The account limit is the one that bites a
    // scripted sweep; the IP limit stops one client cycling through throwaway
    // accounts to reset it. Both survive cold starts, unlike the middleware.
    const [byUid, byIp] = await Promise.all([
      rateLimit({ scope: 'coupon-validate:uid', identifier: decodedToken.uid, limit: 20, windowMs: 60 * 60 * 1000 }),
      rateLimit({ scope: 'coupon-validate:ip', identifier: clientIp(req), limit: 60, windowMs: 60 * 60 * 1000 }),
    ]);
    const blocked = !byUid.allowed ? byUid : !byIp.allowed ? byIp : null;
    if (blocked) {
      return NextResponse.json(
        { valid: false, message: 'Too many coupon attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(blocked.retryAfterSeconds) } },
      );
    }

    const { code } = await req.json().catch(() => ({ code: null }));

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, message: 'Invalid coupon code format.' }, { status: 400 });
    }

    const sanitizedCode = normaliseCouponCode(code);
    const couponSnap = await adminDb.collection('coupons').doc(sanitizedCode).get();
    const evaluation = evaluateCoupon(couponSnap.exists ? couponSnap.data()! : null);

    if (!evaluation.valid) {
      return NextResponse.json(
        { valid: false, message: couponRejectionMessage(evaluation.reason!) },
        { status: 200 },
      );
    }

    return NextResponse.json({
      valid: true,
      discountPercent: evaluation.discountPercent,
      message: `Coupon applied! ${evaluation.discountPercent}% discount activated.`,
    });

  } catch (error: any) {
    console.error('Coupon validation error:', error);
    return NextResponse.json({ valid: false, message: 'Could not validate coupon.' }, { status: 500 });
  }
}
