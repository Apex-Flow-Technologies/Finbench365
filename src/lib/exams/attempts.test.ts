import { describe, it, expect } from 'vitest';
import { resolveMaxAttempts, PRACTICE_MAX_ATTEMPTS, EXAM_MAX_ATTEMPTS } from './attempts';

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
