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
});
