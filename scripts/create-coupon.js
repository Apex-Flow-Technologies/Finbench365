require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

const db = admin.firestore();

async function createCoupon() {
  const couponCode = 'TESTER100';
  
  await db.collection('coupons').doc(couponCode).set({
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
