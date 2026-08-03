import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

/**
 * Exercises grantEntitlementIdempotent against throwaway documents to prove:
 *  1. a coupon-backed grant burns exactly one use,
 *  2. replaying the same orderId burns none (idempotency),
 *  3. an admin grant never burns a use,
 *  4. 'extend' moves an expiry forward, never back.
 *
 * Everything it creates is prefixed __verify_ and deleted in the finally block.
 * It never touches a real user, order or coupon.
 */
const TMP_USER = '__verify_tmp_user';
const TMP_COUPON = '__VERIFY_TMP';
const TMP_ORDER = '__verify_order_1';
const TMP_ORDER_2 = '__verify_order_2';

async function main() {
  const { adminDb } = await import('../src/lib/firebase/admin');
  const { grantEntitlementIdempotent } = await import('../src/lib/payments/grantEntitlement');
  const { PLAN_PRICING } = await import('../src/constants/pricing');

  const planId = Object.keys(PLAN_PRICING)[0];
  const courseSnap = await adminDb.collection('courses').limit(1).get();
  const courseId = courseSnap.docs[0].id;
  const durationDays = PLAN_PRICING[planId].durationDays;

  console.log(`plan=${planId} (${durationDays}d)  course=${courseId}\n`);

  const couponRef = adminDb.collection('coupons').doc(TMP_COUPON);
  const userRef = adminDb.collection('users').doc(TMP_USER);

  try {
    await couponRef.set({
      code: TMP_COUPON, discountPercent: 10, isActive: true,
      maxUses: 5, usedCount: 0, description: 'temporary verification fixture',
    });

    const uses = async () => (await couponRef.get()).data()?.usedCount ?? 0;
    const expiry = async () => {
      const e = (await userRef.get()).data()?.enrolledCourses?.[courseId]?.expiresAt;
      return e?.toMillis?.() ?? 0;
    };
    const check = (label: string, actual: any, expected: any) => {
      const ok = String(actual) === String(expected);
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}, expected ${expected}`);
      if (!ok) process.exitCode = 1;
    };

    console.log('1. coupon-backed grant burns one use');
    await grantEntitlementIdempotent({
      userId: TMP_USER, planId, courseId, paymentId: 'pay_verify_1',
      orderId: TMP_ORDER, amountPaid: 100, source: 'coupon',
      couponCode: TMP_COUPON, skipInvoiceEmail: true,
    });
    check('usedCount', await uses(), 1);
    const firstExpiry = await expiry();

    console.log('2. replaying the same order burns nothing');
    const replay = await grantEntitlementIdempotent({
      userId: TMP_USER, planId, courseId, paymentId: 'pay_verify_1',
      orderId: TMP_ORDER, amountPaid: 100, source: 'coupon',
      couponCode: TMP_COUPON, skipInvoiceEmail: true,
    });
    check('alreadyProcessed', replay.alreadyProcessed, true);
    check('usedCount', await uses(), 1);
    check('expiry unchanged', await expiry(), firstExpiry);

    console.log('3. admin grant never burns a use');
    await grantEntitlementIdempotent({
      userId: TMP_USER, planId, courseId, paymentId: 'pay_verify_2',
      orderId: TMP_ORDER_2, amountPaid: 0, source: 'admin', mode: 'extend',
      couponCode: TMP_COUPON, skipInvoiceEmail: true,
    });
    check('usedCount', await uses(), 1);

    console.log('4. extend moved the expiry forward, not back');
    const extended = await expiry();
    const addedDays = Math.round((extended - firstExpiry) / 86400000);
    check('days added', addedDays, durationDays);
    console.log(`     ${new Date(firstExpiry).toISOString().slice(0, 10)} -> ${new Date(extended).toISOString().slice(0, 10)}`);

    console.log('5. order records the coupon that produced it');
    const orderDoc = await adminDb.collection('orders').doc(TMP_ORDER).get();
    check('couponCode on order', orderDoc.data()?.couponCode, TMP_COUPON);
    check('amountPaid on order', orderDoc.data()?.amountPaid, 100);
  } finally {
    console.log('\ncleaning up fixtures…');
    await Promise.all([
      couponRef.delete(),
      userRef.delete(),
      adminDb.collection('orders').doc(TMP_ORDER).delete(),
      adminDb.collection('orders').doc(TMP_ORDER_2).delete(),
    ]);
    const leftover = await adminDb.collection('coupons').doc(TMP_COUPON).get();
    console.log(`fixtures removed (coupon still present: ${leftover.exists})`);
  }

  process.exit(process.exitCode ?? 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
