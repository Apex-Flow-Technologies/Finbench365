import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { parseDocxText } from './parser';

/**
 * Validation against the real NISM-XV-RA_Mock_Test_1 document.
 *
 * Skipped when the extracted text is not present, so the suite still runs on a
 * clean checkout and in CI. Point MOCK_DOC_TXT at an extracted .docx to re-run
 * this against a new paper.
 */
const DOC = process.env.MOCK_DOC_TXT
  ?? 'C:/Users/sandh/AppData/Local/Temp/claude/D--apex-internship-Finbench365/1f19d202-a04e-4168-8e88-1056c08f8572/scratchpad/mock.txt';

const available = existsSync(DOC);

describe.skipIf(!available)('parsing the real NISM XV mock paper', () => {
  const result = available ? parseDocxText(readFileSync(DOC, 'utf8')) : null;

  it('finds all 100 questions', () => {
    expect(result!.questions).toHaveLength(100);
  });

  it('finds all 5 cases, each with 4 questions', () => {
    expect(result!.cases).toHaveLength(5);
    result!.cases.forEach((c) => expect(c.questionCount).toBe(4));
  });

  it('attaches a passage to every case', () => {
    result!.cases.forEach((c) => expect(c.passage.length).toBeGreaterThan(50));
  });

  it('reads the exam configuration from the header', () => {
    expect(result!.meta).toMatchObject({
      totalQuestions: 100,
      durationMinutes: 120,
      passPercent: 60,
      negativeMarkPercent: 25,
    });
  });

  it('resolves the correct answer for every question', () => {
    const unresolved = result!.questions.filter((q) => q.answerUnresolved);
    expect(unresolved.map((q) => q.number)).toEqual([]);
  });

  it('gives every question four options', () => {
    result!.questions.forEach((q) => {
      expect(q.options).toHaveLength(4);
      q.options.forEach((o) => expect(o.length).toBeGreaterThan(0));
    });
  });

  it('links the 20 case questions to their case and leaves the 80 standalone ones unlinked', () => {
    const linked = result!.questions.filter((q) => q.caseId);
    expect(linked).toHaveLength(20);
    expect(result!.questions.filter((q) => !q.caseId)).toHaveLength(80);
  });

  it('extracts per-option explanations', () => {
    const q1 = result!.questions[0];
    expect(q1.correctOptionIndex).toBe(1); // (b) 12.8%
    expect(q1.optionExplanations[0]).toMatch(/weight the costs/i);
    expect(q1.optionExplanations[1]).toMatch(/WACC|12\.28/i);
  });

  it('reports options whose explanation is present but empty', () => {
    // Q3 in this paper has "(a) Rs. 780 — Incorrect:" with no reason at all.
    // That is a content defect the author needs to see, not something to hide.
    const emptyReasons = result!.warnings.filter((w) => /gives no reason/.test(w));
    expect(emptyReasons.length).toBeGreaterThan(0);
    expect(emptyReasons.some((w) => w.startsWith('Q3:'))).toBe(true);
  });
});
