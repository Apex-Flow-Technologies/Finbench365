import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { adminDb } from '../src/lib/firebase/admin';
import { normaliseCouponCode } from '../src/lib/payments/coupons';

/**
 * Creates a coupon from the command line.
 *
 * This script used to hardcode a permanent, unexpiring, 1000-use, 100%-off code
 * (`TESTER100`) — a working free-access key, committed to version control, that
 * anyone with repository access could read and anyone at all could guess. The
 * parameters are arguments now, and an expiry is mandatory, so a code created
 * for a week of beta testing cannot quietly outlive it.
 *
 * Usage:
 *   npx tsx scripts/create-coupon.ts <CODE> <DISCOUNT_PERCENT> <MAX_USES> <DAYS_VALID>
 *
 * Example — 25% off, 200 redemptions, expires in 30 days:
 *   npx tsx scripts/create-coupon.ts LAUNCH25 25 200 30
 */
async function createCoupon() {
  const [rawCode, rawDiscount, rawMaxUses, rawDays] = process.argv.slice(2);

  if (!rawCode || !rawDiscount || !rawMaxUses || !rawDays) {
    console.error(
      'Usage: npx tsx scripts/create-coupon.ts <CODE> <DISCOUNT_PERCENT> <MAX_USES> <DAYS_VALID>',
    );
    process.exit(1);
  }

  const code = normaliseCouponCode(rawCode);
  const discountPercent = Number(rawDiscount);
  const maxUses = Number(rawMaxUses);
  const daysValid = Number(rawDays);

  if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
    console.error('DISCOUNT_PERCENT must be a whole number between 1 and 100.');
    process.exit(1);
  }
  if (!Number.isInteger(maxUses) || maxUses < 1) {
    console.error('MAX_USES must be a whole number of at least 1.');
    process.exit(1);
  }
  if (!Number.isInteger(daysValid) || daysValid < 1 || daysValid > 365) {
    console.error('DAYS_VALID must be a whole number between 1 and 365.');
    process.exit(1);
  }

  // Overwriting an existing code would silently reset its usedCount, handing
  // back every redemption already spent.
  const existing = await adminDb.collection('coupons').doc(code).get();
  if (existing.exists) {
    console.error(`Coupon ${code} already exists. Edit or deactivate it instead of recreating it.`);
    process.exit(1);
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysValid);

  await adminDb.collection('coupons').doc(code).set({
    code,
    discountPercent,
    isActive: true,
    maxUses,
    usedCount: 0,
    expiresAt,
    createdAt: new Date(),
    description: `${discountPercent}% off, ${maxUses} uses, expires ${expiresAt.toISOString().slice(0, 10)}`,
  });

  console.log(`Created coupon ${code}: ${discountPercent}% off, ${maxUses} uses, expires ${expiresAt.toDateString()}.`);

  if (discountPercent === 100) {
    console.warn(
      '\nWARNING: this is a 100% discount — it grants full course access for free and ' +
      'bypasses the payment gateway entirely. Keep maxUses tight and the window short.',
    );
  }

  process.exit(0);
}

createCoupon().catch((err) => {
  console.error(err);
  process.exit(1);
});
