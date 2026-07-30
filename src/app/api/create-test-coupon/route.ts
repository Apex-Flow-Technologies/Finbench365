import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
  const couponCode = 'TESTER100';
  
  await adminDb.collection('coupons').doc(couponCode).set({
    code: couponCode,
    discountPercent: 100,
    isActive: true,
    maxUses: 1000,
    usedCount: 0,
    createdAt: new Date(),
    description: '100% discount for beta testers'
  });

  return NextResponse.json({ success: true, message: `Successfully created 100% discount coupon: ${couponCode}` });
}
