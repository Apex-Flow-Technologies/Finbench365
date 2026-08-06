import { describe, it, expect } from 'vitest';
import { seededShuffle, orderQuestionsForAttempt } from './shuffle';

const items = Array.from({ length: 50 }, (_, i) => `q${i}`);

describe('seededShuffle', () => {
  it('is stable for the same seed', () => {
    // The property the exam runner depends on: refreshing mid-attempt, or
    // resuming on another device, must not reorder the paper.
    expect(seededShuffle(items, 'attempt-1')).toEqual(seededShuffle(items, 'attempt-1'));
  });

  it('differs between seeds', () => {
    expect(seededShuffle(items, 'attempt-1')).not.toEqual(seededShuffle(items, 'attempt-2'));
  });

  it('is a permutation — nothing added, dropped or duplicated', () => {
    const out = seededShuffle(items, 'attempt-1');
    expect(out).toHaveLength(items.length);
    expect([...out].sort()).toEqual([...items].sort());
  });

  it('does not mutate the input', () => {
    const original = [...items];
    seededShuffle(items, 'attempt-1');
    expect(items).toEqual(original);
  });

  it('actually reorders', () => {
    expect(seededShuffle(items, 'attempt-1')).not.toEqual(items);
  });

  it('handles empty and single-item papers', () => {
    expect(seededShuffle([], 'a')).toEqual([]);
    expect(seededShuffle(['only'], 'a')).toEqual(['only']);
  });

  it('spreads a given question across many positions over many attempts', () => {
    // Guards against a degenerate PRNG that always lands on similar orders.
    const positions = new Set(
      Array.from({ length: 100 }, (_, i) => seededShuffle(items, `attempt-${i}`).indexOf('q0')),
    );
    expect(positions.size).toBeGreaterThan(20);
  });
});

describe('orderQuestionsForAttempt', () => {
  it('leaves order untouched when randomisation is off', () => {
    expect(orderQuestionsForAttempt(items, 'attempt-1', false)).toEqual(items);
    expect(orderQuestionsForAttempt(items, 'attempt-1', undefined)).toEqual(items);
  });

  it('leaves order untouched before an attempt exists', () => {
    // The pre-exam screen has no attempt id yet and only shows a count.
    expect(orderQuestionsForAttempt(items, null, true)).toEqual(items);
  });

  it('shuffles once an attempt is under way', () => {
    const out = orderQuestionsForAttempt(items, 'attempt-1', true);
    expect(out).not.toEqual(items);
    expect([...out].sort()).toEqual([...items].sort());
  });
});
