import { describe, it, expect } from 'vitest';
import { resolveExamSeries, IN_SCOPE_PATTERNS, NISM_EXAM_PATTERNS, findExamPattern } from './examPatterns';

/**
 * The bug these guard against: the exam runner printed a hardcoded "NISM V-A"
 * on every test, so a Research Analyst paper told the candidate sitting it that
 * it was Mutual Fund Distributors.
 */
describe('resolveExamSeries', () => {
  it("uses the test's own series", () => {
    expect(resolveExamSeries({ nismSeries: 'XV' }, { nismSeries: 'V-A' })).toBe('XV');
  });

  it('falls back to the owning course when the test has none', () => {
    expect(resolveExamSeries({ nismSeries: null }, { nismSeries: 'V-D' })).toBe('V-D');
    expect(resolveExamSeries({}, { nismSeries: 'V-D' })).toBe('V-D');
    expect(resolveExamSeries(undefined, { nismSeries: 'V-D' })).toBe('V-D');
  });

  it('returns null rather than guessing when neither has one', () => {
    expect(resolveExamSeries({ nismSeries: null }, { nismSeries: null })).toBeNull();
    expect(resolveExamSeries(null, null)).toBeNull();
    expect(resolveExamSeries(undefined, undefined)).toBeNull();
  });

  it('never invents V-A — the exact defect reported from production', () => {
    // A non-NISM course ("Financial Markets: Structure & Practice") must show
    // no badge at all, not the old default.
    expect(resolveExamSeries({ nismSeries: '' }, { nismSeries: '' })).not.toBe('V-A');
    expect(resolveExamSeries({ nismSeries: '' }, { nismSeries: '' })).toBeNull();
  });

  it('rejects a stored value that is not a real series', () => {
    expect(resolveExamSeries({ nismSeries: 'NOT-A-SERIES' }, null)).toBeNull();
    // ...but still falls through to a course that does have a valid one.
    expect(resolveExamSeries({ nismSeries: 'garbage' }, { nismSeries: 'XII' })).toBe('XII');
  });

  it('normalises casing and whitespace to the table spelling', () => {
    expect(resolveExamSeries({ nismSeries: ' v-a ' }, null)).toBe('V-A');
    expect(resolveExamSeries({ nismSeries: 'xv' }, null)).toBe('XV');
  });

  it('resolves every in-scope series to itself', () => {
    for (const p of IN_SCOPE_PATTERNS) {
      expect(resolveExamSeries({ nismSeries: p.series }, null)).toBe(p.series);
    }
  });
});

describe('IN_SCOPE_PATTERNS', () => {
  it('includes X-A, which is published and sold but was missing from both editor dropdowns', () => {
    expect(IN_SCOPE_PATTERNS.map((p) => p.series)).toContain('X-A');
  });

  it('still leads with V-A, V-B, V-D — the homepage renders only the first three', () => {
    expect(IN_SCOPE_PATTERNS.slice(0, 3).map((p) => p.series)).toEqual(['V-A', 'V-B', 'V-D']);
  });

  it('every in-scope series is resolvable by findExamPattern', () => {
    for (const p of IN_SCOPE_PATTERNS) {
      expect(findExamPattern(p.series)?.series).toBe(p.series);
    }
  });
});

describe('editor dropdown source', () => {
  it('offers every official series, including X-B and the XIX AIF series', () => {
    const all = NISM_EXAM_PATTERNS.map((p) => p.series);
    for (const s of ['X-B', 'XIX-A', 'XIX-B', 'XIX-C', 'XIX-D', 'XIX-E']) expect(all).toContain(s);
    for (const s of all) expect(resolveExamSeries({ nismSeries: s }, null)).toBe(s);
  });
});
