import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { rateLimit, clientIp } from '@/lib/api/rateLimit';

/**
 * Server-side coupon validation.
 *
 * This endpoint answers "is CODE valid, and for how much?", which makes it a
 * guessing oracle for discount codes. Codes are short and human-chosen, and a
 * discovered 100%-off code grants free course access through the bypass path
 * in create-order — so this must not be open to anonymous callers.
 *
 * The coupons collection itself is deliberately unreadable by clients
 * (see firestore.rules); leaving this endpoint unauthenticated would have
 * handed out the same information one guess at a time.
 */
export async function POST(req: Request) {
  try {
    // Sign-in required. A coupon is only usable at checkout, which already
    // requires an account, so this costs a real customer nothing.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ valid: false, message: 'Please sign in to apply a coupon.' }, { status: 401 });
    }
    let uid: string;
    try {
      uid = (await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1])).uid;
    } catch {
      return NextResponse.json({ valid: false, message: 'Please sign in to apply a coupon.' }, { status: 401 });
    }

    // Durable, cross-instance limits. The in-memory middleware counter resets
    // on cold start and is per-instance, so it cannot bound guessing on its own.
    const [byUser, byIp] = await Promise.all([
      rateLimit({ scope: 'coupon-check:uid', identifier: uid, limit: 20, windowMs: 60 * 60 * 1000 }),
      rateLimit({ scope: 'coupon-check:ip', identifier: clientIp(req), limit: 40, windowMs: 60 * 60 * 1000 }),
    ]);
    const blocked = !byUser.allowed ? byUser : !byIp.allowed ? byIp : null;
    if (blocked) {
      return NextResponse.json(
        { valid: false, message: 'Too many coupon attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(blocked.retryAfterSeconds) } },
      );
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, message: 'Invalid coupon code format.' }, { status: 400 });
    }

    const sanitizedCode = code.trim().toUpperCase();

    // Look up coupon in Firestore
    const couponRef = adminDb.collection('coupons').doc(sanitizedCode);
    const couponDoc = await couponRef.get();

    if (!couponDoc.exists) {
      return NextResponse.json({ valid: false, message: 'Coupon code not found.' }, { status: 200 });
    }

    const couponData = couponDoc.data()!;

    // Check if coupon is active
    if (!couponData.isActive) {
      return NextResponse.json({ valid: false, message: 'This coupon has expired or been deactivated.' }, { status: 200 });
    }

    // Check usage limit
    if (couponData.maxUses && couponData.usedCount >= couponData.maxUses) {
      return NextResponse.json({ valid: false, message: 'This coupon has reached its maximum usage limit.' }, { status: 200 });
    }

    // Expiry. Must mirror the check in create-order exactly — if this said
    // "valid" for an expired code the candidate would see a discount applied
    // in the summary and then be charged full price at the gateway.
    if (couponData.expiresAt) {
      const expiresAtMs = typeof couponData.expiresAt.toMillis === 'function'
        ? couponData.expiresAt.toMillis()
        : new Date(couponData.expiresAt).getTime();
      if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
        return NextResponse.json({ valid: false, message: 'This coupon has expired.' }, { status: 200 });
      }
    }

    return NextResponse.json({
      valid: true,
      discountPercent: couponData.discountPercent || 0,
      message: `Coupon applied! ${couponData.discountPercent || 0}% discount activated.`
    });

  } catch (error: any) {
    console.error('Coupon validation error:', error);
    return NextResponse.json({ valid: false, message: 'Could not validate coupon.' }, { status: 500 });
  }
}
