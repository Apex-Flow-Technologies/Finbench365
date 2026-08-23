import { describe, it, expect } from 'vitest';
import {
  evaluateCoupon, normaliseCouponCode, couponRejectionMessage, couponCourseIds,
  couponRedemptionKey,
} from './coupons';

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

  /**
   * A discount meant for particular exams must not be spendable across the
   * whole catalogue. `forExam` builds the original single-`courseId` shape,
   * which live codes still use, so these cases double as the compatibility
   * guard for it.
   */
  describe('exam-specific coupons', () => {
    const forExam = (courseId: string) => valid({ courseId });
    const forExams = (...courseIds: string[]) => valid({ courseIds });

    it('accepts the code on the exam it was made for', () => {
      expect(evaluateCoupon(forExam('nism-va'), 'nism-va').valid).toBe(true);
    });

    it('refuses it on a different exam', () => {
      expect(evaluateCoupon(forExam('nism-va'), 'nism-xv'))
        .toMatchObject({ valid: false, reason: 'wrong-course', discountPercent: 0 });
    });

    it('refuses it when no exam is supplied', () => {
      expect(evaluateCoupon(forExam('nism-va'), null))
        .toMatchObject({ valid: false, reason: 'wrong-course' });
    });

    it('leaves unrestricted codes working everywhere, as before', () => {
      expect(evaluateCoupon(valid(), 'nism-va').valid).toBe(true);
      expect(evaluateCoupon(valid(), 'anything-else').valid).toBe(true);
      expect(evaluateCoupon(valid(), null).valid).toBe(true);
    });

    it('reports on a restricted code without an exam, for the admin list', () => {
      // No second argument at all: not a purchase, so the scope is not judged.
      expect(evaluateCoupon(forExam('nism-va')).valid).toBe(true);
    });

    it('still applies the other checks to a restricted code', () => {
      expect(evaluateCoupon(valid({ courseId: 'nism-va', isActive: false }), 'nism-va'))
        .toMatchObject({ reason: 'inactive' });
      expect(evaluateCoupon(valid({ courseId: 'nism-va', maxUses: 1, usedCount: 1 }), 'nism-va'))
        .toMatchObject({ reason: 'exhausted' });
    });

    it('has a message a candidate can act on', () => {
      expect(couponRejectionMessage('wrong-course')).toMatch(/not valid for the exam/i);
    });

    it('accepts any exam in a multi-exam scope, and refuses the rest', () => {
      const c = forExams('nism-va', 'nism-xv');
      expect(evaluateCoupon(c, 'nism-va').valid).toBe(true);
      expect(evaluateCoupon(c, 'nism-xv').valid).toBe(true);
      expect(evaluateCoupon(c, 'nism-viii'))
        .toMatchObject({ valid: false, reason: 'wrong-course', discountPercent: 0 });
    });

    it('treats an empty courseIds list as every exam', () => {
      // The admin form posts [] for "All exams" rather than omitting the field,
      // so an empty array must not read as "restricted to nothing".
      expect(evaluateCoupon(forExams(), 'nism-va').valid).toBe(true);
      expect(evaluateCoupon(forExams(), null).valid).toBe(true);
    });

    it('prefers courseIds when a document carries both fields', () => {
      // Only reachable if a document were written by mixed-version code. The
      // array is the field this version writes, so it is the one that decides.
      const c = valid({ courseId: 'nism-va', courseIds: ['nism-xv'] });
      expect(evaluateCoupon(c, 'nism-xv').valid).toBe(true);
      expect(evaluateCoupon(c, 'nism-va')).toMatchObject({ reason: 'wrong-course' });
    });

    it('still applies the other checks to a multi-exam code', () => {
      expect(evaluateCoupon(valid({ courseIds: ['nism-va'], isActive: false }), 'nism-va'))
        .toMatchObject({ reason: 'inactive' });
      expect(evaluateCoupon(valid({ courseIds: ['nism-va'], maxUses: 1, usedCount: 1 }), 'nism-va'))
        .toMatchObject({ reason: 'exhausted' });
    });

    describe('couponCourseIds', () => {
      it('reads the modern array and the original single field alike', () => {
        expect(couponCourseIds({ courseIds: ['a', 'b'] })).toEqual(['a', 'b']);
        expect(couponCourseIds({ courseId: 'a' })).toEqual(['a']);
      });

      it('returns an empty scope for an unrestricted or missing coupon', () => {
        expect(couponCourseIds({})).toEqual([]);
        expect(couponCourseIds({ courseId: null })).toEqual([]);
        expect(couponCourseIds(null)).toEqual([]);
      });

      it('drops junk entries rather than scoping a code to them', () => {
        // A non-string in the array would never equal a courseId, so leaving it
        // in would silently narrow the scope for no visible reason.
        expect(couponCourseIds({ courseIds: ['a', '', null, 7, 'b'] })).toEqual(['a', 'b']);
      });
    });
  });
});


/**
 * A coupon is spendable once per candidate, for good.
 *
 * Enrolment expires and can be renewed on purpose, so the record of having
 * spent a code has to outlast the access it bought — otherwise every renewal
 * is another discount, forever.
 */
describe('one redemption per candidate', () => {
  it('refuses a code the candidate has already spent', () => {
    expect(evaluateCoupon(valid(), 'nism-va', { alreadyRedeemed: true }))
      .toEqual({ valid: false, reason: 'already-redeemed', discountPercent: 0 });
  });

  it('behaves exactly as before when the caller does not supply the fact', () => {
    // The regression net for every existing case: an omitted, undefined or
    // false flag must leave the other rules untouched.
    for (const opts of [undefined, {}, { alreadyRedeemed: false }]) {
      expect(evaluateCoupon(valid(), 'nism-va', opts).valid).toBe(true);
    }
  });

  it('does not judge redemption for the admin list', () => {
    // serialise() reports on the coupon itself. Whether one candidate has spent
    // it is a fact about that candidate, so "usable" must not depend on it.
    expect(evaluateCoupon(valid()).valid).toBe(true);
  });

  describe('precedence against the other rejections', () => {
    const redeemed = { alreadyRedeemed: true };

    it('does not reveal that an unknown or switched-off code exists', () => {
      // Telling someone "you already used this" about a code that does not
      // exist, or is switched off, confirms it is real to someone probing.
      expect(evaluateCoupon(null, 'nism-va', redeemed)).toMatchObject({ reason: 'not-found' });
      expect(evaluateCoupon(valid({ isActive: false }), 'nism-va', redeemed))
        .toMatchObject({ reason: 'inactive' });
    });

    it('reports the wrong exam first, since that is the actionable fault', () => {
      expect(evaluateCoupon(valid({ courseIds: ['nism-xv'] }), 'nism-va', redeemed))
        .toMatchObject({ reason: 'wrong-course' });
    });

    it('outranks exhaustion and expiry', () => {
      // Both are true of the code rather than the candidate; being told the
      // code is spent out is misleading when they personally already used it.
      expect(evaluateCoupon(valid({ maxUses: 1, usedCount: 1 }), 'nism-va', redeemed))
        .toMatchObject({ reason: 'already-redeemed' });
      expect(evaluateCoupon(valid({ expiresAt: new Date(Date.now() - 1000) }), 'nism-va', redeemed))
        .toMatchObject({ reason: 'already-redeemed' });
    });
  });

  it('has its own message rather than the generic one', () => {
    const message = couponRejectionMessage('already-redeemed');
    expect(message).toMatch(/already used/i);
    expect(message).not.toBe(couponRejectionMessage('not-found'));
  });
});

describe('couponRedemptionKey', () => {
  it('treats the same address written differently as one candidate', () => {
    expect(couponRedemptionKey('  A@B.COM ')).toBe(couponRedemptionKey('a@b.com'));
  });

  it('is a sha256 hex digest, so it is always a safe document id', () => {
    // "/" is legal in an RFC 5322 local part and would otherwise become a path
    // separator, writing the redemption somewhere else entirely.
    const key = couponRedemptionKey('a/b@example.com');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('separates different candidates', () => {
    expect(couponRedemptionKey('a@x.com')).not.toBe(couponRedemptionKey('b@x.com'));
  });

  it('treats a plus-tagged address as a different candidate', () => {
    // Pinned deliberately. Matching addresses exactly is the literal reading of
    // the rule; collapsing plus-tags and Gmail dots is a policy call for the
    // operator, and doing it here would silently make it for them.
    expect(couponRedemptionKey('alice+1@x.com')).not.toBe(couponRedemptionKey('alice@x.com'));
  });

  it('returns null rather than a shared key when there is no address', () => {
    // Every unidentifiable candidate hashing to one document would read as
    // "this coupon is already spent" for all of them.
    for (const bad of ['', '   ', null, undefined]) {
      expect(couponRedemptionKey(bad)).toBeNull();
    }
  });
});
