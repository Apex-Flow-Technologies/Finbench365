/**
 * How many times a candidate may sit a given test.
 *
 * This lived as the bare literal `10` in three places — the submit route and
 * two dashboard pages — which is exactly the arrangement that lets the server
 * and the badge above the Start button disagree about the same rule.
 *
 * Kept out of scoring.ts on purpose. That module is server-only today, imported
 * just by finalise.ts, and two client pages need this resolver; putting it there
 * would pull the whole grader into the browser bundle to read one number.
 */

/**
 * Practice Mode. Repetition is the point of a practice test, so the cap is a
 * guard against runaway data rather than a scarcity rule.
 */
export const PRACTICE_MAX_ATTEMPTS = 10;

/**
 * Exam Mode — the timed, no-answer-key sitting that stands in for the real
 * thing. Three is the operator's decision: a rehearsal that can be repeated
 * indefinitely stops resembling the exam it is rehearsing.
 */
export const EXAM_MAX_ATTEMPTS = 3;

/**
 * A ceiling on the per-test override. Not a policy — a guard, so a mistyped
 * figure in the editor cannot effectively remove the cap.
 */
const MAX_ATTEMPTS_CEILING = 50;

/**
 * The number of attempts allowed on one test.
 *
 * An explicit `maxAttempts` on the test wins; otherwise the mode decides. The
 * override exists because every test built through the course Exam Builder is
 * created as Exam Mode — that is how it gets its timer — so without a lever the
 * operator would have no way to leave a particular paper on the old allowance.
 *
 * Anything that is not a whole number of at least 1 is ignored rather than
 * coerced. The editor writes this field as a raw string and updateMockTest
 * launders it; if that laundering ever fails, falling back to the mode default
 * is the safe direction — coercing would turn a stray "" or "abc" into 0 or NaN
 * and lock every candidate out of the paper.
 */
export function resolveMaxAttempts(testData: Record<string, any> | null | undefined): number {
  const override = testData?.maxAttempts;

  // Number.isInteger already rejects NaN, Infinity and 1.5; the typeof guard is
  // what rejects the string forms the editor can produce.
  if (typeof override === 'number' && Number.isInteger(override) && override >= 1) {
    return Math.min(override, MAX_ATTEMPTS_CEILING);
  }

  // Deliberately checks for 'exam' rather than defaulting to it: createMockTest
  // writes 'practice' by default, so an absent or unrecognised mode must land
  // on the generous allowance, not the strict one.
  return testData?.type === 'exam' ? EXAM_MAX_ATTEMPTS : PRACTICE_MAX_ATTEMPTS;
}

/**
 * When an attempt was started, in epoch milliseconds.
 *
 * The field was renamed from `startTime` to `startedAt` at one point and older
 * attempts still carry the original name, so both are read — the same fallback
 * the server grader makes.
 *
 * Returns null when there is nothing usable rather than guessing. In a timed
 * exam a wrong start is a wrong clock, and the caller can fall back to the full
 * duration, which is only ever generous.
 */
export function attemptStartedAtMs(
  attempt: Record<string, any> | null | undefined,
): number | null {
  const raw = attempt?.startedAt ?? attempt?.startTime;
  if (!raw) return null;

  const ms =
    // Firestore Timestamp, from either SDK.
    typeof raw.toMillis === 'function' ? raw.toMillis()
      : typeof raw.toDate === 'function' ? raw.toDate()?.getTime()
        : raw instanceof Date ? raw.getTime()
          : new Date(raw).getTime();

  return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
}

/**
 * Seconds left on a timed paper, worked out from when it actually started.
 *
 * The exam runner used to set the clock to the paper's full duration on every
 * page load, which meant the remaining time lived only in memory. On a laptop
 * that went unnoticed because the tab stays open. On a phone, leaving the
 * browser evicts the page, and coming back mounted the runner afresh — so a
 * candidate who had already used forty minutes was handed the full duration
 * again, on the same attempt. Their answers came back correctly, because those
 * are saved; only the clock was reinvented.
 *
 * Deriving it from `startedAt` also closes it as a way to cheat: reopening the
 * tab no longer buys more time on any device. The server already noticed and
 * recorded `flaggedOverTime`, but it still graded the paper, so nothing
 * actually stopped it.
 *
 * Returns null when the inputs cannot support an honest answer, so the caller
 * decides what to do rather than being handed a 0 that submits someone.
 */
export function remainingSeconds(
  startedAtMs: number | null,
  durationMinutes: unknown,
  now: number = Date.now(),
): number | null {
  if (startedAtMs === null || !Number.isFinite(startedAtMs)) return null;
  if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return null;
  }

  const total = Math.round(durationMinutes * 60);
  const elapsed = Math.floor((now - startedAtMs) / 1000);

  // Clamped at both ends. Below zero the paper is over; above the total means
  // the start is in the future, which is a clock disagreement between the
  // device and the server rather than extra time the candidate has earned.
  return Math.min(total, Math.max(0, total - elapsed));
}
