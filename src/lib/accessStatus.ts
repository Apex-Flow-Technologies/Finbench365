/**
 * How much access a candidate has left on one course.
 *
 * Mirrors the dashboard's course cards exactly — days are rounded up, and
 * access is expired at zero days — so the dashboard and the settings page can
 * never disagree about the same entitlement.
 *
 * Unlike the dashboard's inline maths, a missing or non-positive
 * `durationDays` yields `pct: null` (draw no bar) rather than NaN.
 */
export interface AccessStatus {
  isExpired: boolean;
  /** Whole days remaining, rounded up. 0 or less once expired. */
  daysLeft: number;
  /** Share of the plan still remaining, 0–100, or null when unknowable. */
  pct: number | null;
}

const DAY_MS = 1000 * 3600 * 24;

export function accessStatus(
  expiresAt: Date,
  durationDays: number | null | undefined,
  now: Date = new Date(),
): AccessStatus {
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
  const isExpired = daysLeft <= 0;

  let pct: number | null = null;
  if (typeof durationDays === 'number' && Number.isFinite(durationDays) && durationDays > 0) {
    pct = isExpired ? 0 : Math.min(100, Math.max(0, (daysLeft / durationDays) * 100));
  }

  return { isExpired, daysLeft, pct };
}
