import { describe, it, expect } from 'vitest';
import { evaluateCoupon, normaliseCouponCode, couponRejectionMessage } from './coupons';

const HOUR = 60 * 60 * 1000;
const valid = (extra: Record<string, any> = {}) => ({
  isActive: true, discountPercent: 25, maxUses: 100, usedCount: 0, ...extra,
});

describe('normaliseCouponCode', () => {
  it('upper-cases and trims, because the code is the document id', () => {
    expect(normaliseCouponCode('  launch25 ')).toBe('LAUNCH25');
  });
});

describe('evaluateCoupon', () => {
  it('accepts a live coupon and returns its discount', () => {
    expect(evaluateCoupon(valid())).toEqual({ valid: true, discountPercent: 25 });
  });

  it('rejects a missing coupon', () => {
    expect(evaluateCoupon(null)).toMatchObject({ valid: false, reason: 'not-found' });
  });

  it('rejects a deactivated coupon', () => {
    expect(evaluateCoupon(valid({ isActive: false }))).toMatchObject({ reason: 'inactive' });
  });

  it('rejects once maxUses is reached', () => {
    expect(evaluateCoupon(valid({ maxUses: 5, usedCount: 5 }))).toMatchObject({ reason: 'exhausted' });
    expect(evaluateCoupon(valid({ maxUses: 5, usedCount: 6 }))).toMatchObject({ reason: 'exhausted' });
  });

  it('allows the final use', () => {
    // Off-by-one here either burns a use nobody got or hands out one too many.
    expect(evaluateCoupon(valid({ maxUses: 5, usedCount: 4 })).valid).toBe(true);
  });

  it('treats an absent maxUses as unlimited', () => {
    expect(evaluateCoupon(valid({ maxUses: undefined, usedCount: 9999 })).valid).toBe(true);
  });

  it('rejects an expired coupon, accepting Timestamps or Dates', () => {
    const past = Date.now() - HOUR;
    expect(evaluateCoupon(valid({ expiresAt: { toMillis: () => past } }))).toMatchObject({ reason: 'expired' });
    expect(evaluateCoupon(valid({ expiresAt: new Date(past) }))).toMatchObject({ reason: 'expired' });
  });

  it('accepts a coupon that has not expired yet', () => {
    expect(evaluateCoupon(valid({ expiresAt: new Date(Date.now() + HOUR) })).valid).toBe(true);
  });

  it('treats a coupon with no expiry as non-expiring', () => {
    // Regression guard: toMillis() returns 0 for an absent value, so a bare
    // `expiresAt <= Date.now()` check would read every open-ended coupon as
    // expired and silently stop honouring all of them.
    expect(evaluateCoupon(valid({ expiresAt: undefined })).valid).toBe(true);
    expect(evaluateCoupon(valid({ expiresAt: null })).valid).toBe(true);
  });

  it('reports zero discount on every rejection', () => {
    for (const c of [null, valid({ isActive: false }), valid({ maxUses: 1, usedCount: 1 })]) {
      expect(evaluateCoupon(c).discountPercent).toBe(0);
    }
  });

  it('defaults a missing discountPercent to 0 rather than NaN', () => {
    expect(evaluateCoupon(valid({ discountPercent: undefined }))).toEqual({ valid: true, discountPercent: 0 });
  });

  it('supports a 100% discount, which bypasses the gateway entirely', () => {
    expect(evaluateCoupon(valid({ discountPercent: 100 }))).toEqual({ valid: true, discountPercent: 100 });
  });
});

describe('couponRejectionMessage', () => {
  it('does not distinguish a non-existent code from a deactivated one', () => {
    // Saying "this code exists but is switched off" tells a caller probing the
    // namespace more than they need to know.
    expect(couponRejectionMessage('not-found')).toBe(couponRejectionMessage('inactive'));
  });

  it('gives an actionable message for expiry and exhaustion', () => {
    expect(couponRejectionMessage('expired')).toMatch(/expired/i);
    expect(couponRejectionMessage('exhausted')).toMatch(/limit/i);
  });
});
