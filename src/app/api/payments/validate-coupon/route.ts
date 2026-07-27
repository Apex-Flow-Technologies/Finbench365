import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

// Server-side coupon validation — never expose coupon logic client-side
export async function POST(req: Request) {
  try {
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
