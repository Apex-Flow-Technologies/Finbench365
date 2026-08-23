import { createHash } from 'node:crypto';

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

export type CouponRejection =
  | 'not-found' | 'inactive' | 'exhausted' | 'expired' | 'wrong-course' | 'already-redeemed';

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
 * The document id recording that one email address has redeemed one coupon.
 *
 * A coupon may be spent once per candidate. Enrolment expires and can be
 * renewed, so the ledger cannot live on the enrolment — it has to outlast it,
 * which is why it is keyed off the address rather than the entitlement.
 *
 * The address is hashed rather than used directly. `/` is a legal character in
 * an RFC 5322 local part, and a `/` in a document id silently becomes a path
 * separator — `a/b@x.com` would write to the wrong place rather than fail.
 * Hashing also keeps a real email address out of Firestore paths, which turn up
 * in logs, console URLs and index entries.
 *
 * Returns null for anything unusable, so callers have to decide explicitly what
 * to do when they cannot identify the candidate rather than silently keying
 * every such redemption to the same document.
 *
 * Note this matches addresses exactly: plus-tags and Gmail's dots are NOT
 * normalised away, so alice+1@x.com and alice@x.com are two candidates. That is
 * the literal reading of the rule; treating them as one person is a policy
 * decision for the operator, not one to smuggle in here.
 */
export function couponRedemptionKey(email: string | null | undefined): string | null {
  if (typeof email !== 'string') return null;
  const normalised = email.trim().toLowerCase();
  if (!normalised) return null;
  return createHash('sha256').update(normalised).digest('hex');
}

/**
 * The exams a coupon is restricted to. An empty array means every exam.
 *
 * Scope is stored as `courseIds`, but the first version of this feature stored
 * a single `courseId` and codes created then are still live, so the singular
 * field is read as a one-exam scope rather than migrated. Reading through this
 * one function is what keeps that compatibility in a single place instead of
 * at every call site.
 */
export function couponCourseIds(data: Record<string, any> | null | undefined): string[] {
  if (!data) return [];
  if (Array.isArray(data.courseIds)) {
    return data.courseIds.filter((id: unknown): id is string => typeof id === 'string' && id !== '');
  }
  return typeof data.courseId === 'string' && data.courseId ? [data.courseId] : [];
}

/**
 * Decides whether a coupon may be applied. Takes the raw document data (or null
 * when the document does not exist) so it stays pure and testable — the caller
 * owns the Firestore read.
 */
export function evaluateCoupon(
  data: Record<string, any> | null,
  /**
   * The exam the candidate is buying. A coupon restricted to a set of exams
   * that does not include it is refused. Omitted only where no purchase is in
   * progress — the admin list, which is reporting on the coupon itself rather
   * than applying it.
   */
  courseId?: string | null,
  /**
   * Facts the caller had to read from the database, kept out of this function
   * so it stays pure and testable. Absent means "not checked", which is what
   * the admin list wants — whether one candidate has spent a code is a fact
   * about that candidate, not about the coupon.
   */
  opts?: { alreadyRedeemed?: boolean },
): CouponEvaluation {
  if (!data) return { valid: false, reason: 'not-found', discountPercent: 0 };
  if (!data.isActive) return { valid: false, reason: 'inactive', discountPercent: 0 };

  // An empty scope works on every exam, which is what every coupon created
  // before scoping existed did — so those codes keep behaving as they did.
  // Once the scope is non-empty the code only works on the exams in it, which
  // stops a discount meant for a few exams being spread across the catalogue.
  const scope = couponCourseIds(data);
  if (scope.length > 0 && courseId !== undefined && !scope.includes(courseId as string)) {
    return { valid: false, reason: 'wrong-course', discountPercent: 0 };
  }

  // One redemption per candidate, for good. Deliberately checked before the
  // usage limit: a candidate who has already spent this code should be told so
  // whether or not the code has any uses left on it.
  if (opts?.alreadyRedeemed) {
    return { valid: false, reason: 'already-redeemed', discountPercent: 0 };
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
    // Needs its own case: falling through to the default would tell a candidate
    // their own code is "not valid", which reads as a mistake on their part
    // rather than a code they have already had the benefit of.
    case 'already-redeemed':
      return 'You have already used this code.';
    // 'not-found' and 'inactive' share a message deliberately: telling a caller
    // that a code exists but is switched off is more than they need to know.
    case 'not-found':
    case 'inactive':
    default:
      return 'This coupon code is not valid.';
  }
}
