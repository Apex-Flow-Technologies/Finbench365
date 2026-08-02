import { GST_RATE, RAZORPAY_FEE_RATE } from '@/constants/pricing';

/**
 * Revenue derived from the `orders` collection.
 *
 * The admin overview previously summed `users.totalSpent`, a field written in
 * only one recently-added code path — so historical payments were invisible and
 * the headline read Rs 0. It also mixed units: `orders.amount` was ex-GST while
 * `totalSpent` accumulated incl-GST, so no two screens could ever agree.
 *
 * Orders are the ledger. Every figure below comes from them.
 */

export interface OrderLike {
  status?: string;
  orderId?: string;
  amountPaid?: number;   // incl-GST, what the gateway actually captured
  amountBase?: number;   // ex-GST, post-discount
  gstAmount?: number;
  createdAt?: any;       // Firestore Timestamp | Date | string | number
}

export interface RevenueSummary {
  /** Cash actually taken, GST included. The headline figure. */
  collected: number;
  /** Portion of `collected` that is GST and must be remitted — not yours. */
  gstPayable: number;
  /** Indicative take-home: ex-GST revenue minus the gateway's cut. */
  netAfterFees: number;
  /** Refunded back to customers. Excluded from `collected`. */
  refunded: number;
  /** Orders that moved real money. */
  paidCount: number;
  /** Free enrolments (100% coupon / admin grant). Deliberately not revenue. */
  compedCount: number;
  /** Orders created but never paid — pipeline, not revenue. */
  unpaidCount: number;
  /**
   * Successful orders whose captured amount could not be established (e.g.
   * created under different gateway keys). Excluded from every figure above
   * and surfaced so the total is never quietly understated without explanation.
   */
  unknownAmountCount: number;
}

export function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/** A comped enrolment: succeeded, but no money changed hands. */
export function isComped(order: OrderLike): boolean {
  if (order.status === 'bypassed') return true;
  return order.status === 'success'
    && (order.amountPaid === 0 || String(order.orderId ?? '').startsWith('BYPASS-'));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summariseRevenue(
  orders: OrderLike[],
  opts: { since?: Date } = {},
): RevenueSummary {
  const sinceMs = opts.since ? opts.since.getTime() : null;

  let collected = 0;
  let refunded = 0;
  let paidCount = 0;
  let compedCount = 0;
  let unpaidCount = 0;
  let unknownAmountCount = 0;

  for (const order of orders) {
    if (sinceMs !== null && toMillis(order.createdAt) < sinceMs) continue;

    if (order.status === 'refunded') {
      refunded += order.amountPaid ?? 0;
      continue;
    }

    if (order.status === 'created') {
      unpaidCount++;
      continue;
    }

    if (order.status !== 'success' && order.status !== 'bypassed') continue;

    if (isComped(order)) {
      compedCount++;
      continue;
    }

    // Absent rather than zero: the amount is unknown, not nil. Counting it as
    // zero would understate revenue while looking like a complete figure.
    if (typeof order.amountPaid !== 'number') {
      unknownAmountCount++;
      continue;
    }

    collected += order.amountPaid;
    paidCount++;
  }

  // collected is GST-inclusive, so the tax portion is what's left once the
  // pre-tax base is removed.
  const gstPayable = collected - collected / (1 + GST_RATE);

  return {
    collected: round2(collected),
    gstPayable: round2(gstPayable),
    netAfterFees: round2(collected / (1 + GST_RATE) - collected * RAZORPAY_FEE_RATE),
    refunded: round2(refunded),
    paidCount,
    compedCount,
    unpaidCount,
    unknownAmountCount,
  };
}

export function formatInr(amount: number, opts: { decimals?: boolean } = {}): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  })}`;
}
