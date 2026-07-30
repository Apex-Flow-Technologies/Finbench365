import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { adminDb } from '../src/lib/firebase/admin';

async function createCoupon() {
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

  console.log(`Successfully created 100% discount coupon: ${couponCode}`);
  process.exit(0);
}

createCoupon().catch(console.error);
