import { describe, it, expect } from 'vitest';
import {
  resolveMaxAttempts, PRACTICE_MAX_ATTEMPTS, EXAM_MAX_ATTEMPTS,
  attemptStartedAtMs, remainingSeconds,
} from './attempts';

describe('resolveMaxAttempts', () => {
  it('gives Exam Mode three attempts and Practice Mode ten', () => {
    expect(resolveMaxAttempts({ type: 'exam' })).toBe(EXAM_MAX_ATTEMPTS);
    expect(resolveMaxAttempts({ type: 'practice' })).toBe(PRACTICE_MAX_ATTEMPTS);
    expect(EXAM_MAX_ATTEMPTS).toBe(3);
    expect(PRACTICE_MAX_ATTEMPTS).toBe(10);
  });

  it('falls back to the generous allowance when the mode is missing or unknown', () => {
    // Deliberate: createMockTest defaults `type` to 'practice', so an absent or
    // unrecognised mode must never quietly become the three-attempt rule and
    // lock candidates out of a paper the operator thought was a practice test.
    for (const testData of [undefined, null, {}, { type: undefined }, { type: 'quiz' }]) {
      expect(resolveMaxAttempts(testData)).toBe(PRACTICE_MAX_ATTEMPTS);
    }
  });

  describe('the per-test override', () => {
    it('wins over the mode default, in both directions', () => {
      // The lever that lets an existing paper keep its old allowance when the
      // Exam Mode default drops to three.
      expect(resolveMaxAttempts({ type: 'exam', maxAttempts: 10 })).toBe(10);
      expect(resolveMaxAttempts({ type: 'practice', maxAttempts: 2 })).toBe(2);
    });

    it('allows a single-sitting paper', () => {
      expect(resolveMaxAttempts({ type: 'exam', maxAttempts: 1 })).toBe(1);
    });

    it('ignores anything that is not a whole number of at least one', () => {
      // Coercing instead would turn a stray '' or 'abc' into 0 or NaN and lock
      // every candidate out of the test. Falling back is the safe direction.
      for (const bad of [0, -1, 1.5, NaN, Infinity, '5', 'abc', '', null, true, {}]) {
        expect(resolveMaxAttempts({ type: 'exam', maxAttempts: bad })).toBe(EXAM_MAX_ATTEMPTS);
      }
    });

    it('rejects the string form the editor produces', () => {
      // The settings grid writes e.target.value straight onto the draft, so an
      // unlaundered save arrives here as a string. Pinned so a change to
      // updateMockTest's num() laundering cannot silently disable the override.
      expect(resolveMaxAttempts({ type: 'practice', maxAttempts: '3' })).toBe(PRACTICE_MAX_ATTEMPTS);
    });

    it('caps a mistyped figure rather than effectively removing the limit', () => {
      expect(resolveMaxAttempts({ type: 'exam', maxAttempts: 99999 })).toBe(50);
    });
  });
});

const MIN = 60 * 1000;

describe('attemptStartedAtMs', () => {
  it('reads a Firestore Timestamp', () => {
    expect(attemptStartedAtMs({ startedAt: { toMillis: () => 1750000000000 } })).toBe(1750000000000);
  });

  it('reads a Timestamp that only offers toDate, and a plain Date', () => {
    const when = new Date('2026-08-23T10:00:00Z');
    expect(attemptStartedAtMs({ startedAt: { toDate: () => when } })).toBe(when.getTime());
    expect(attemptStartedAtMs({ startedAt: when })).toBe(when.getTime());
  });

  it('falls back to the legacy startTime field', () => {
    // Attempts predating the rename still carry it, and the server grader
    // makes the same fallback. Missing it would hand those candidates a fresh
    // clock on every resume.
    const when = new Date('2026-08-23T10:00:00Z');
    expect(attemptStartedAtMs({ startTime: when })).toBe(when.getTime());
  });

  it('prefers startedAt when a document somehow carries both', () => {
    expect(attemptStartedAtMs({ startedAt: { toMillis: () => 2000 }, startTime: new Date(1000) }))
      .toBe(2000);
  });

  it('returns null rather than guessing a start', () => {
    // A wrong start is a wrong clock in a timed exam, so the caller is left to
    // decide instead of being handed a plausible-looking number.
    for (const bad of [null, undefined, {}, { startedAt: null }, { startedAt: 'not a date' }]) {
      expect(attemptStartedAtMs(bad)).toBeNull();
    }
  });
});

describe('remainingSeconds', () => {
  const started = 1750000000000;

  it('subtracts the time already spent', () => {
    expect(remainingSeconds(started, 120, started + 40 * MIN)).toBe(80 * 60);
  });

  it('gives the whole paper at the moment it starts', () => {
    expect(remainingSeconds(started, 120, started)).toBe(120 * 60);
  });

  it('floors at zero once the paper is over', () => {
    // The regression this whole function exists for: a candidate returning
    // after the duration has passed must not be handed a fresh clock.
    expect(remainingSeconds(started, 120, started + 121 * MIN)).toBe(0);
    expect(remainingSeconds(started, 120, started + 10000 * MIN)).toBe(0);
  });

  it('never returns more than the paper allows', () => {
    // A start in the future means the device and server clocks disagree, not
    // that the candidate has earned extra time.
    expect(remainingSeconds(started, 120, started - 30 * MIN)).toBe(120 * 60);
  });

  it('returns null when it cannot answer honestly', () => {
    // The caller falls back to the full duration, which is only ever generous —
    // far better than a 0 that submits someone the instant they resume.
    expect(remainingSeconds(null, 120, started)).toBeNull();
    for (const bad of [undefined, null, 0, -5, NaN, Infinity, '120']) {
      expect(remainingSeconds(started, bad, started)).toBeNull();
    }
  });
});
