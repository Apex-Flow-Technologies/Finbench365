import { describe, it, expect } from 'vitest';
import { gradeAttempt, resolveExamPattern } from './scoring';
import { findExamPattern } from '@/constants/examPatterns';

/** Answer key where the correct option for question N is N % 4. */
const key = (n: number) => new Map(Array.from({ length: n }, (_, i) => [`q${i}`, i % 4]));

/** Answer the first `correct` questions right and the next `wrong` questions wrong. */
function answers(correct: number, wrong: number): Record<string, number> {
  const a: Record<string, number> = {};
  for (let i = 0; i < correct; i++) a[`q${i}`] = i % 4;
  for (let i = correct; i < correct + wrong; i++) a[`q${i}`] = ((i % 4) + 1) % 4;
  return a;
}

describe('resolveExamPattern', () => {
  it('defaults to no negative marking when a test is unconfigured', () => {
    // A test nobody has configured must never silently start deducting marks.
    expect(resolveExamPattern(null).negativeMarkPercent).toBe(0);
    expect(resolveExamPattern({}).negativeMarkPercent).toBe(0);
    expect(resolveExamPattern({}).marksPerQuestion).toBe(1);
  });

  it('reads values off the test document', () => {
    const c = resolveExamPattern({ marksPerQuestion: 2, negativeMarkPercent: 25, passPercent: 60 });
    expect(c).toEqual({ marksPerQuestion: 2, negativeMarkPercent: 25, passPercent: 60 });
  });

  it('clamps out-of-range values instead of producing unexplainable scores', () => {
    expect(resolveExamPattern({ negativeMarkPercent: 500 }).negativeMarkPercent).toBe(100);
    expect(resolveExamPattern({ negativeMarkPercent: -10 }).negativeMarkPercent).toBe(0);
    expect(resolveExamPattern({ passPercent: 250 }).passPercent).toBe(100);
  });

  it('ignores non-numeric junk', () => {
    expect(resolveExamPattern({ negativeMarkPercent: 'lots' }).negativeMarkPercent).toBe(0);
    expect(resolveExamPattern({ marksPerQuestion: NaN }).marksPerQuestion).toBe(1);
  });
});

describe('gradeAttempt — no negative marking (V-A, V-B, XII)', () => {
  const config = { marksPerQuestion: 1, negativeMarkPercent: 0, passPercent: 50 };

  it('scores correct answers only', () => {
    const r = gradeAttempt(key(100), answers(60, 40), config);
    expect(r).toMatchObject({
      correctCount: 60, wrongCount: 40, unattemptedCount: 0,
      score: 60, maxMarks: 100, percentage: 60, passed: true,
    });
    expect(r.marksDeducted).toBe(0);
  });

  it('fails below the pass mark', () => {
    expect(gradeAttempt(key(100), answers(49, 51), config).passed).toBe(false);
    expect(gradeAttempt(key(100), answers(50, 50), config).passed).toBe(true);
  });
});

describe('gradeAttempt — negative marking (Research Analyst XV, 25%)', () => {
  const config = { marksPerQuestion: 1, negativeMarkPercent: 25, passPercent: 60 };

  it('deducts a quarter mark per wrong answer', () => {
    // 60 right, 40 wrong -> 60 - (40 * 0.25) = 50
    const r = gradeAttempt(key(100), answers(60, 40), config);
    expect(r.marksEarned).toBe(60);
    expect(r.marksDeducted).toBe(10);
    expect(r.score).toBe(50);
    expect(r.percentage).toBe(50);
    expect(r.passed).toBe(false); // 50% < 60% — negative marking changes the outcome
  });

  it('never penalises an unattempted question', () => {
    // The whole point of negative marking: skipping must beat guessing wrong.
    const skipped = gradeAttempt(key(100), answers(60, 0), config);
    const guessed = gradeAttempt(key(100), answers(60, 40), config);
    expect(skipped.unattemptedCount).toBe(40);
    expect(skipped.marksDeducted).toBe(0);
    expect(skipped.score).toBe(60);
    expect(skipped.score).toBeGreaterThan(guessed.score);
  });

  it('handles a fully wrong paper without going below 0%', () => {
    const r = gradeAttempt(key(100), answers(0, 100), config);
    expect(r.score).toBe(-25);      // raw score stays honest for auditing
    expect(r.percentage).toBe(0);   // but is not shown to a candidate as negative
    expect(r.passed).toBe(false);
  });

  it('scales the penalty with the mark value of the question', () => {
    // 25% of a 2-mark question is 0.5, not 0.25.
    const r = gradeAttempt(key(10), answers(0, 4), { ...config, marksPerQuestion: 2 });
    expect(r.marksDeducted).toBe(2);
    expect(r.maxMarks).toBe(20);
  });
});

describe('gradeAttempt — edge cases', () => {
  const config = { marksPerQuestion: 1, negativeMarkPercent: 25, passPercent: 60 };

  it('treats option 0 as a real answer, not as unanswered', () => {
    // q0's correct option IS 0. A falsy check would score this as skipped.
    const r = gradeAttempt(new Map([['q0', 0]]), { q0: 0 }, config);
    expect(r.correctCount).toBe(1);
    expect(r.unattemptedCount).toBe(0);
  });

  it('ignores answers to questions that are not in the key', () => {
    const r = gradeAttempt(new Map([['q0', 1]]), { q0: 1, ghost: 3 }, config);
    expect(r.correctCount).toBe(1);
    expect(r.maxMarks).toBe(1);
  });

  it('handles an empty submission', () => {
    const r = gradeAttempt(key(50), {}, config);
    expect(r).toMatchObject({ correctCount: 0, wrongCount: 0, unattemptedCount: 50, score: 0, percentage: 0, passed: false });
  });

  it('does not divide by zero on a test with no questions', () => {
    const r = gradeAttempt(new Map(), {}, config);
    expect(r.maxMarks).toBe(0);
    expect(r.percentage).toBe(0);
  });
});

describe('grading against the real NISM patterns', () => {
  it('V-A passes at 50% with no negative marking', () => {
    const p = findExamPattern('V-A')!;
    const config = { marksPerQuestion: 1, negativeMarkPercent: p.negativeMarkPercent, passPercent: p.passPercent };
    expect(p.negativeMarkPercent).toBe(0);
    expect(gradeAttempt(key(p.maxMarks), answers(50, 50), config).passed).toBe(true);
  });

  it('XV needs 60 clean marks once 25% negative marking is applied', () => {
    const p = findExamPattern('XV')!;
    const config = { marksPerQuestion: 1, negativeMarkPercent: p.negativeMarkPercent, passPercent: p.passPercent };
    // 68 right / 32 wrong -> 68 - 8 = 60 -> exactly 60%, a pass.
    expect(gradeAttempt(key(100), answers(68, 32), config)).toMatchObject({ score: 60, passed: true });
    // One fewer correct and it fails.
    expect(gradeAttempt(key(100), answers(67, 33), config).passed).toBe(false);
  });

  it('is case-insensitive when looking a series up', () => {
    expect(findExamPattern('v-a')?.series).toBe('V-A');
    expect(findExamPattern('nope')).toBeNull();
  });
});
