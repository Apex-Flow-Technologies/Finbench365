import { toMillis } from '@/lib/admin/revenue';

/**
 * Coupon evaluation, in one place.
 *
 * This logic previously existed as two hand-kept copies — one in
 * /api/payments/validate-coupon (what the candidate is told) and one in
 * /api/payments/create-order (what they are actually charged). A comment in the
 * former warned that it "must mirror the check in create-order exactly", which
 * is a rule a human has to remember on every edit. Drift between the two is not
 * cosmetic: it shows a discount in the order summary and then charges full
 * price at the gateway.
 */

export type CouponRejection = 'not-found' | 'inactive' | 'exhausted' | 'expired' | 'wrong-course';

export interface CouponEvaluation {
  valid: boolean;
  /** Only set when `valid` is false. */
  reason?: CouponRejection;
  /** 0 unless the coupon is valid. */
  discountPercent: number;
}

/** Coupons are stored under their upper-cased code as the document id. */
export function normaliseCouponCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Decides whether a coupon may be applied. Takes the raw document data (or null
 * when the document does not exist) so it stays pure and testable — the caller
 * owns the Firestore read.
 */
export function evaluateCoupon(
  data: Record<string, any> | null,
  /**
   * The exam the candidate is buying. A coupon restricted to a different exam
   * is refused. Omitted only where no purchase is in progress — the admin list,
   * which is reporting on the coupon itself rather than applying it.
   */
  courseId?: string | null,
): CouponEvaluation {
  if (!data) return { valid: false, reason: 'not-found', discountPercent: 0 };
  if (!data.isActive) return { valid: false, reason: 'inactive', discountPercent: 0 };

  // A coupon with no courseId works on every exam, which is what every coupon
  // created before this did — so existing codes keep behaving as they did.
  // Once a courseId is set the code only works on that exam, which stops a
  // discount meant for one exam being spread across the whole catalogue.
  if (data.courseId && courseId !== undefined && data.courseId !== courseId) {
    return { valid: false, reason: 'wrong-course', discountPercent: 0 };
  }

  if (data.maxUses && (data.usedCount ?? 0) >= data.maxUses) {
    return { valid: false, reason: 'exhausted', discountPercent: 0 };
  }

  // Guarded on presence first: toMillis() returns 0 for an absent value, and a
  // bare `0 <= Date.now()` would read every coupon without an expiry as expired.
  if (data.expiresAt) {
    const expiresAtMs = toMillis(data.expiresAt);
    if (expiresAtMs && expiresAtMs <= Date.now()) {
      return { valid: false, reason: 'expired', discountPercent: 0 };
    }
  }

  return { valid: true, discountPercent: data.discountPercent || 0 };
}

/** Candidate-facing copy for each rejection. */
export function couponRejectionMessage(reason: CouponRejection): string {
  switch (reason) {
    case 'exhausted':
      return 'This coupon has reached its maximum usage limit.';
    case 'wrong-course':
      return 'This code is not valid for the exam you have selected.';
    case 'expired':
      return 'This coupon has expired.';
    // 'not-found' and 'inactive' share a message deliberately: telling a caller
    // that a code exists but is switched off is more than they need to know.
    case 'not-found':
    case 'inactive':
    default:
      return 'This coupon code is not valid.';
  }
}
