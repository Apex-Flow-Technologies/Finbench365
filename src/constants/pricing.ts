/**
 * `tier` orders the plans so entitlement can be compared numerically.
 *
 * Study notes carry a minimum tier, and a candidate can open a note only when
 * their plan's tier is at least that high — which is how the Excel workbook and
 * metrics tracker stay exclusive to the 60-day plan. A number rather than a plan
 * id because the check also has to run inside Firestore rules, where a lookup
 * table is not available: comparing two integers is the one thing rules do well.
 *
 * Tiers must stay ascending with what a plan includes. Adding a plan between
 * two existing ones means renumbering, so leave gaps if that seems likely.
 */
export const PLAN_PRICING: Record<string, { price: number; durationDays: number; name: string; tier: number }> = {
  'plan-10': {
    price: 499,
    durationDays: 10,
    name: 'Plan 1 — 10 Days',
    tier: 1,
  },
  'plan-30': {
    price: 599,
    durationDays: 30,
    name: 'Plan 2 — 30 Days',
    tier: 2,
  },
  'plan-60': {
    price: 699,
    durationDays: 60,
    name: 'Plan 3 — 60 Days',
    tier: 3,
  },
};

/** Lowest tier — what an unconfigured or legacy entitlement is treated as. */
export const BASE_PLAN_TIER = 1;

/** The tier a plan grants; unknown plans fall back to the lowest. */
export function planTier(planId: string | undefined | null): number {
  return (planId && PLAN_PRICING[planId]?.tier) || BASE_PLAN_TIER;
}

/**
 * Choices for the "minimum plan" control on a study note.
 *
 * Deliberately two, not three. Plans 1 and 2 differ only in how long access
 * lasts — they carry identical content — so a "30-day and above" restriction
 * would describe a distinction the product does not make. The only real content
 * boundary is plan 3, which adds the Excel workbooks and formula sheets.
 *
 * The tier numbers still run 1..3 so the entitlement comparison keeps working;
 * it is only the offered choices that collapse to two.
 */
export const PLAN_TIER_OPTIONS = [
  { tier: 1, label: 'All plans' },
  { tier: 3, label: 'Only 60-day plan' },
];

/**
 * Snaps a stored minimum tier onto one of the offered choices.
 *
 * A note saved against the withdrawn "30-day and above" option still holds a
 * tier of 2. Left alone it would select nothing in the dropdown, and an admin
 * who saved the course without noticing would write back whatever the blank
 * control produced. Anything above "all plans" resolves to the 60-day
 * restriction, which is the only restriction the product now offers.
 */
export function normalisePlanTier(tier: number | undefined | null): number {
  return !tier || tier <= BASE_PLAN_TIER ? BASE_PLAN_TIER : 3;
}

export const GST_RATE = 0.18;

/**
 * A LAST-RESORT stand-in for Razorpay's cut: a 2% platform fee plus 18% GST on
 * that fee (2% x 1.18 = 2.36%). Used only for orders whose real fee has not
 * been fetched yet, and every such order is counted so the admin panel can say
 * the figure is still an estimate.
 *
 * Treat this number as fiction, because a single blended rate cannot describe
 * what is actually charged. Measured on this account (11 Aug 2026, every
 * captured payment, fee read from the payment entity):
 *
 *     upi          4 payments   Rs 1405.64 charged   Rs  0.00 fees   0.000%
 *     netbanking   1 payment    Rs  588.82 charged   Rs 13.90 fees   2.361%
 *
 * Note what that does NOT mean. UPI is not free by law: the 0% mandate covers
 * the NPCI rails, and Razorpay does levy a platform fee on UPI for many
 * merchants. Zero here is a term of THIS account's pricing plan, and it can
 * change with a renegotiation, a volume tier or a plan migration. So never
 * hard-code a per-method rate anywhere — read the fee off each payment.
 *
 * The authoritative figure is always the gateway's own settlement report.
 */
export const RAZORPAY_FEE_RATE = 0.0236;
