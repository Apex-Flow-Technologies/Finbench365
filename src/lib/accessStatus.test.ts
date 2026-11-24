import { describe, it, expect } from 'vitest';
import { accessStatus } from './accessStatus';

const NOW = new Date('2026-11-24T12:00:00Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * 24 * 3600 * 1000);

describe('accessStatus', () => {
  it('counts whole days remaining, rounded up like the dashboard', () => {
    expect(accessStatus(inDays(10), 30, NOW).daysLeft).toBe(10);
    expect(accessStatus(inDays(9.2), 30, NOW).daysLeft).toBe(10);
  });

  it('is active with time left, expired at or past zero', () => {
    expect(accessStatus(inDays(1), 30, NOW).isExpired).toBe(false);
    expect(accessStatus(inDays(0), 30, NOW).isExpired).toBe(true);
    expect(accessStatus(inDays(-5), 30, NOW).isExpired).toBe(true);
  });

  it('reports the share of the plan remaining', () => {
    expect(accessStatus(inDays(15), 30, NOW).pct).toBe(50);
    expect(accessStatus(inDays(-1), 30, NOW).pct).toBe(0);
  });

  it('clamps when more time remains than the plan length (an extended grant)', () => {
    expect(accessStatus(inDays(70), 60, NOW).pct).toBe(100);
  });

  it('draws no bar when the plan length is unknown, instead of NaN', () => {
    expect(accessStatus(inDays(10), undefined, NOW).pct).toBeNull();
    expect(accessStatus(inDays(10), null, NOW).pct).toBeNull();
    expect(accessStatus(inDays(10), 0, NOW).pct).toBeNull();
    expect(accessStatus(inDays(10), NaN, NOW).pct).toBeNull();
  });
});
