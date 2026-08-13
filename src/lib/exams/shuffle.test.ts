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

  /**
   * Reported from a live paper: question 84 was a case sub-question whose
   * siblings sat at 83, 91 and 94, so the case tabs jumped around the palette.
   */
  describe('case questions stay together', () => {
    const paper = [
      { id: 'a', caseId: null },
      { id: 'c1a', caseId: 'C1' }, { id: 'c1b', caseId: 'C1' },
      { id: 'c1c', caseId: 'C1' }, { id: 'c1d', caseId: 'C1' },
      { id: 'b', caseId: null },
      { id: 'c2a', caseId: 'C2' }, { id: 'c2b', caseId: 'C2' },
      { id: 'c', caseId: null }, { id: 'd', caseId: null },
    ];
    const runs = ['att-1', 'att-2', 'att-3', 'att-4', 'att-5'].map(
      (a) => orderQuestionsForAttempt(paper, a, true));

    it('keeps every case contiguous, in every attempt', () => {
      for (const out of runs) {
        for (const cid of ['C1', 'C2']) {
          const idx = out.map((q, i) => (q.caseId === cid ? i : -1)).filter((i) => i >= 0);
          expect(idx).toHaveLength(cid === 'C1' ? 4 : 2);
          expect(idx[idx.length - 1] - idx[0]).toBe(idx.length - 1);
        }
      }
    });

    it('keeps sub-questions in the order the author wrote them', () => {
      for (const out of runs) {
        expect(out.filter((q) => q.caseId === 'C1').map((q) => q.id))
          .toEqual(['c1a', 'c1b', 'c1c', 'c1d']);
      }
    });

    it('still loses no question and still varies between attempts', () => {
      for (const out of runs) {
        expect(out).toHaveLength(paper.length);
        expect(new Set(out.map((q) => q.id)).size).toBe(paper.length);
      }
      expect(new Set(runs.map((r) => r.map((q) => q.id).join(','))).size).toBeGreaterThan(1);
    });

    it('is stable for one attempt id', () => {
      expect(orderQuestionsForAttempt(paper, 'att-9', true).map((q) => q.id))
        .toEqual(orderQuestionsForAttempt(paper, 'att-9', true).map((q) => q.id));
    });
  });
});
