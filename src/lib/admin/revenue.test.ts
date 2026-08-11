import { describe, it, expect } from 'vitest';
import { summariseRevenue, isComped, toMillis, formatInr, type OrderLike } from './revenue';

const paid = (amountPaid: number, extra: Partial<OrderLike> = {}): OrderLike => ({
  status: 'success', orderId: 'order_1', amountPaid, ...extra,
});

describe('toMillis', () => {
  it('reads Firestore Timestamps, Dates, strings and numbers', () => {
    const ms = Date.UTC(2026, 0, 15);
    expect(toMillis({ toMillis: () => ms })).toBe(ms);
    expect(toMillis({ toDate: () => new Date(ms) })).toBe(ms);
    expect(toMillis(new Date(ms))).toBe(ms);
    expect(toMillis(ms)).toBe(ms);
  });

  it('returns 0 rather than NaN for absent or unparseable values', () => {
    // Callers compare the result against Date.now(); NaN would silently make
    // every comparison false instead of failing visibly.
    expect(toMillis(null)).toBe(0);
    expect(toMillis(undefined)).toBe(0);
    expect(toMillis('not a date')).toBe(0);
  });
});

describe('isComped', () => {
  it('treats a zero-amount success and a BYPASS- order as comped', () => {
    expect(isComped(paid(0))).toBe(true);
    expect(isComped({ status: 'success', orderId: 'BYPASS-abc', amountPaid: 706.82 })).toBe(true);
    expect(isComped({ status: 'bypassed' })).toBe(true);
  });

  it('does not treat an ordinary paid order as comped', () => {
    expect(isComped(paid(706.82))).toBe(false);
  });
});

describe('summariseRevenue', () => {
  it('sums only what actually changed hands', () => {
    const r = summariseRevenue([paid(1000), paid(180), { status: 'created' }]);
    expect(r.collected).toBe(1180);
    expect(r.paidCount).toBe(2);
    expect(r.unpaidCount).toBe(1);
  });

  it('splits GST out of a GST-inclusive total', () => {
    // 1180 incl. 18% == 1000 base + 180 tax.
    const r = summariseRevenue([paid(1180)]);
    expect(r.collected).toBe(1180);
    expect(r.gstPayable).toBeCloseTo(180, 2);
  });

  it('excludes comped enrolments from revenue but counts them', () => {
    const r = summariseRevenue([paid(1180), paid(0)]);
    expect(r.collected).toBe(1180);
    expect(r.paidCount).toBe(1);
    expect(r.compedCount).toBe(1);
  });

  it('excludes refunds from collected and reports them separately', () => {
    const r = summariseRevenue([paid(1180), { status: 'refunded', amountPaid: 500 }]);
    expect(r.collected).toBe(1180);
    expect(r.refunded).toBe(500);
  });

  it('still counts a revoked order as revenue — access was withdrawn, money was not returned', () => {
    // Revoking is not refunding. Treating the two the same understated
    // takings by the value of every account an admin had ever revoked.
    const r = summariseRevenue([{ status: 'revoked', orderId: 'order_1', amountPaid: 706.82 }]);
    expect(r.collected).toBe(706.82);
    expect(r.paidCount).toBe(1);
    expect(r.refunded).toBe(0);
  });

  it('still counts a refund that the gateway has not confirmed', () => {
    // The money is ours until Razorpay says otherwise; removing it early would
    // double-count the loss once the refund actually lands.
    const r = summariseRevenue([{ status: 'refund_pending', orderId: 'order_1', amountPaid: 500 }]);
    expect(r.collected).toBe(500);
    expect(r.refunded).toBe(0);
  });

  it('moves the money out only once the refund is confirmed', () => {
    const pending = summariseRevenue([{ status: 'refund_pending', orderId: 'o1', amountPaid: 500 }]);
    const done = summariseRevenue([{ status: 'refunded', orderId: 'o1', amountPaid: 500 }]);
    expect(pending.collected).toBe(500);
    expect(done.collected).toBe(0);
    expect(done.refunded).toBe(500);
  });

  it('ignores a status it does not recognise rather than guessing', () => {
    const r = summariseRevenue([paid(1180), { status: 'something_new', amountPaid: 9999 }]);
    expect(r.collected).toBe(1180);
  });

  it('reports an unknown amount instead of counting it as zero', () => {
    // The distinction the admin panel depends on: a missing figure must not be
    // silently folded in as 0, which would understate revenue while looking
    // like a complete total.
    const r = summariseRevenue([paid(1180), { status: 'success', orderId: 'order_2' }]);
    expect(r.collected).toBe(1180);
    expect(r.unknownAmountCount).toBe(1);
    expect(r.paidCount).toBe(1);
  });

  it('honours the `since` window', () => {
    const old = paid(1000, { createdAt: new Date('2020-01-01') });
    const recent = paid(500, { createdAt: new Date('2026-01-01') });
    const r = summariseRevenue([old, recent], { since: new Date('2025-01-01') });
    expect(r.collected).toBe(500);
  });

  it('returns zeroes for an empty ledger without dividing by zero', () => {
    const r = summariseRevenue([]);
    expect(r.collected).toBe(0);
    expect(r.gstPayable).toBe(0);
    expect(r.netAfterFees).toBe(0);
  });

  it('nets out GST and the gateway fee', () => {
    const r = summariseRevenue([paid(1180)]);
    // 1180 / 1.18 = 1000 ex-GST, less 2.36% of the gross (27.848).
    expect(r.netAfterFees).toBeCloseTo(1000 - 1180 * 0.0236, 2);
    expect(r.netAfterFees).toBeLessThan(r.collected);
  });
});

describe('formatInr', () => {
  it('formats with and without decimals', () => {
    expect(formatInr(1180, { decimals: true })).toContain('1,180.00');
    expect(formatInr(1180)).toContain('1,180');
  });

  /**
   * "Net after fees" was a single blended rate applied to everything. Razorpay
   * prices UPI, cards and net banking differently, so the blend could never say
   * where the money actually went — only roughly how much left.
   */
  describe('gateway fees', () => {
    const paid = (extra: Record<string, unknown> = {}) => ({
      status: 'success', orderId: 'order_1', amountPaid: 1180, ...extra,
    });

    it('uses the real fee when the order has been synced', () => {
      const r = summariseRevenue([paid({ gatewayFee: 20, gatewayFeeTax: 3.6 })]);
      expect(r.gatewayFees).toBeCloseTo(23.6, 2);
      expect(r.gatewayFeeGst).toBeCloseTo(3.6, 2);
      expect(r.estimatedFeeCount).toBe(0);
      expect(r.netAfterFees).toBeCloseTo(1000 - 23.6, 2);
    });

    it('falls back to the blended rate and says so', () => {
      const r = summariseRevenue([paid()]);
      expect(r.estimatedFeeCount).toBe(1);
      expect(r.gatewayFees).toBeCloseTo(1180 * 0.0236, 2);
    });

    it('counts a zero fee as a real answer, not a missing one', () => {
      const r = summariseRevenue([paid({ gatewayFee: 0, gatewayFeeTax: 0 })]);
      expect(r.estimatedFeeCount).toBe(0);
      expect(r.gatewayFees).toBe(0);
      expect(r.netAfterFees).toBeCloseTo(1000, 2);
    });

    it('mixes synced and unsynced orders without hiding the estimate', () => {
      const r = summariseRevenue([
        paid({ orderId: 'order_1', gatewayFee: 20, gatewayFeeTax: 3.6 }),
        paid({ orderId: 'order_2' }),
      ]);
      expect(r.paidCount).toBe(2);
      expect(r.estimatedFeeCount).toBe(1);
      expect(r.gatewayFees).toBeCloseTo(23.6 + 1180 * 0.0236, 2);
    });

    it('charges no gateway fee on a comped enrolment', () => {
      const r = summariseRevenue([{ status: 'bypassed', orderId: 'BYPASS-1', amountPaid: 0 }]);
      expect(r.gatewayFees).toBe(0);
      expect(r.estimatedFeeCount).toBe(0);
      expect(r.compedCount).toBe(1);
    });
  });
});
