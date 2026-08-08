import { describe, it, expect } from 'vitest';
import { parseCasePassage } from './casePassage';

/** Verbatim from NISM-XV-RA_Mock_Test_1, Case 1 — one unbroken run. */
const REAL = 'You are a research analyst covering XYZ Ltd., a diversified manufacturing company. The following financial information is available:Balance Sheet (Rs. in Crores) as on March 31, 2025:Equity Share Capital: 800 (Face Value Rs. 10)Reserves & Surplus: 2,400Long-term Debt: 1,600Short-term Debt: 400Current Assets: 1,200Current Liabilities: 800Fixed Assets: 4,000Cash & Cash Equivalents: 300Financial Investments: 200Income Statement (Rs. in Crores) for FY 2024-25:Revenue: 8,000Cost of Goods Sold: 4,500Operating Expenses: 1,800EBIT: 800Interest Expense: 160Tax (30%): 192Net Profit: 448Additional Information:Market Price per Share: Rs. 75Industry Average: PE = 14x, EV/EBITDA = 8x, ROE = 16%';

describe('parseCasePassage — the real paper', () => {
  const r = parseCasePassage(REAL);

  it('finds the three sections the passage actually contains', () => {
    expect(r.isPlainProse).toBe(false);
    expect(r.blocks).toHaveLength(3);
    expect(r.blocks[0].title).toContain('Balance Sheet');
    expect(r.blocks[1].title).toContain('Income Statement');
    expect(r.blocks[2].title).toContain('Additional Information');
  });

  it('keeps the scene-setting sentence out of the data', () => {
    expect(r.intro).toContain('research analyst covering XYZ Ltd');
    expect(r.intro).not.toContain('8,000');
  });

  it('splits the run-on balance sheet into its individual figures', () => {
    const bs = r.blocks[0].items;
    expect(bs.length).toBeGreaterThanOrEqual(9);
    expect(bs).toContainEqual({ label: 'Reserves & Surplus', value: '2,400' });
    expect(bs).toContainEqual({ label: 'Long-term Debt', value: '1,600' });
    expect(bs).toContainEqual({ label: 'Cash & Cash Equivalents', value: '300' });
  });

  it('keeps a value that contains its own brackets intact', () => {
    expect(r.blocks[0].items[0]).toEqual({
      label: 'Equity Share Capital',
      value: '800 (Face Value Rs. 10)',
    });
  });

  it('reads the income statement figures', () => {
    const is = r.blocks[1].items;
    expect(is).toContainEqual({ label: 'Revenue', value: '8,000' });
    expect(is).toContainEqual({ label: 'Net Profit', value: '448' });
    expect(is).toContainEqual({ label: 'Tax (30%)', value: '192' });
  });

  it('handles a value with a currency prefix and a multi-part value', () => {
    const add = r.blocks[2].items;
    expect(add).toContainEqual({ label: 'Market Price per Share', value: 'Rs. 75' });
    expect(add.find((i) => i.label === 'Industry Average')?.value).toContain('PE = 14x');
  });

  it('loses none of the figures', () => {
    const total = r.blocks.reduce((n, b) => n + b.items.length, 0);
    expect(total).toBeGreaterThanOrEqual(18);
  });
});

describe('parseCasePassage — other shapes', () => {
  it('is not tied to accounting headings', () => {
    // The point of keying off shape, not vocabulary.
    const r = parseCasePassage('A client approaches you.Risk Profile:Age: 42Annual Income: 18,00,000Dependants: 3Portfolio Snapshot:Equity: 65%Debt: 25%Gold: 10%');
    expect(r.blocks.map((b) => b.title)).toEqual(['Risk Profile', 'Portfolio Snapshot']);
    expect(r.blocks[1].items).toContainEqual({ label: 'Equity', value: '65%' });
  });

  it('respects line breaks an author wrote', () => {
    const r = parseCasePassage('Intro line.\nHoldings:\nEquity: 60\nDebt: 40');
    expect(r.intro).toBe('Intro line.');
    expect(r.blocks[0].items).toHaveLength(2);
  });

  it('returns prose untouched when there is no structure', () => {
    const prose = 'A fund manager is reviewing the scheme information document before a launch and wants to confirm the disclosure requirements.';
    const r = parseCasePassage(prose);
    expect(r.isPlainProse).toBe(true);
    expect(r.intro).toBe(prose);
    expect(r.blocks).toEqual([]);
  });

  it('does not treat a sentence ending in a colon as a section', () => {
    const r = parseCasePassage('Consider the following: the market fell sharply and the client panicked.');
    expect(r.isPlainProse).toBe(true);
  });

  it('does not mistake prose containing a colon for a data row', () => {
    // No digit in the value, so it is not a figure.
    const r = parseCasePassage('Holdings:\nNote: the client prefers liquid assets\nEquity: 60');
    expect(r.blocks[0].items).toEqual([{ label: 'Equity', value: '60' }]);
    expect(r.blocks[0].notes.join(' ')).toContain('prefers liquid assets');
  });

  it('gives data appearing before any heading a home', () => {
    const r = parseCasePassage('Revenue: 8,000\nProfit: 448');
    expect(r.blocks[0].title).toBe('Details');
    expect(r.blocks[0].items).toHaveLength(2);
  });

  it('handles empty input without throwing', () => {
    expect(parseCasePassage('').blocks).toEqual([]);
    expect(parseCasePassage(null).isPlainProse).toBe(true);
    expect(parseCasePassage(undefined).intro).toBe('');
  });
});
