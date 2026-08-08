import { describe, it, expect } from 'vitest';

// The splitter is the part worth testing; the component around it is markup.
// Re-implemented import via the module's internal behaviour through a re-export
// would need the component, so the logic is exercised through its observable
// contract: given source text, how many lines does a reader get?
import { ExplanationBody } from './ExplanationBody';

/** Pulls the rendered lines back out without a DOM, by reading the element tree. */
function linesOf(text: string): string[] {
  const el: any = ExplanationBody({ text });
  // Single-paragraph branch
  if (el.type === 'p') return [el.props.children];
  return (el.props.children as any[]).map((c) => c.props.children);
}

describe('ExplanationBody', () => {
  it('leaves ordinary prose as one paragraph', () => {
    const prose = 'Higher operating margins indicate better profitability and efficiency, which typically command a premium valuation multiple.';
    expect(linesOf(prose)).toEqual([prose]);
  });

  it('breaks a run-on calculation into separate steps', () => {
    // Verbatim from the Research Analyst paper — unreadable as one line.
    const working = 'Ke = Rf + β × (Rm - Rf) = 6% + 1.4 × 7% = 15.8% Kd = 10% × (1 - 0.30) = 7% We = 1,800 / 3,000 = 0.60 Wd = 1,200 / 3,000 = 0.40';
    const lines = linesOf(working);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines[0]).toContain('Ke =');
    expect(lines.some((l) => l.startsWith('Kd ='))).toBe(true);
    expect(lines.some((l) => l.startsWith('We ='))).toBe(true);
    expect(lines.some((l) => l.startsWith('Wd ='))).toBe(true);
  });

  it('respects newlines an author already wrote', () => {
    expect(linesOf('Step one\nStep two\nStep three')).toEqual(['Step one', 'Step two', 'Step three']);
  });

  it('puts stage headings on their own line', () => {
    const lines = linesOf('Stage 1: D1 = 18 × 1.10 = 19.80 Stage 2: TV = 30.44 / 0.09 = 338.22');
    expect(lines.some((l) => l.startsWith('Stage 2:'))).toBe(true);
  });

  it('does not split text with only one equals sign', () => {
    // A single "=" is usually prose mentioning a formula, not working.
    const s = 'The ratio is calculated as EPS = Net Profit divided by the number of shares outstanding.';
    expect(linesOf(s)).toEqual([s]);
  });

  it('handles empty and whitespace input without throwing', () => {
    expect(linesOf('')).toEqual(['']);
    expect(() => linesOf('   ')).not.toThrow();
  });
});
