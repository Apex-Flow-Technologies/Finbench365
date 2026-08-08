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

/** Choices for the "minimum plan" control on a study note. */
export const PLAN_TIER_OPTIONS = [
  { tier: 1, label: 'All plans' },
  { tier: 2, label: '30-day plan and above' },
  { tier: 3, label: '60-day plan only' },
];

export const GST_RATE = 0.18;

/**
 * Razorpay's cut as a fraction of the gross amount charged: a 2% platform fee
 * plus 18% GST levied on that fee (2% x 1.18 = 2.36%). Used only for the
 * indicative "net after fees" figure in the admin panel — the authoritative
 * number is always the Razorpay settlement report.
 */
export const RAZORPAY_FEE_RATE = 0.0236;
