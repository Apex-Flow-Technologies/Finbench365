import { describe, it, expect } from 'vitest';
import { parseDocxText } from './parser';

const q = (n: number, correct: 'a' | 'b' | 'c' | 'd', opts = ['One', 'Two', 'Three', 'Four']) => `
Q${n}. Question number ${n}?
(a) ${opts[0]}
(b) ${opts[1]}
(c) ${opts[2]}
(d) ${opts[3]}
Explanation:
(a) ${opts[0]} — ${correct === 'a' ? 'Correct: because reason A' : 'Incorrect: reason A'}
(b) ${opts[1]} — ${correct === 'b' ? 'Correct: because reason B' : 'Incorrect: reason B'}
(c) ${opts[2]} — ${correct === 'c' ? 'Correct: because reason C' : 'Incorrect: reason C'}
(d) ${opts[3]} — ${correct === 'd' ? 'Correct: because reason D' : 'Incorrect: reason D'}
`;

describe('parseDocxText — Section A', () => {
  it('extracts question, options and the correct index from the explanation block', () => {
    const { questions, warnings } = parseDocxText(q(1, 'b'));
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      number: 1,
      text: 'Question number 1?',
      options: ['One', 'Two', 'Three', 'Four'],
      correctOptionIndex: 1,
      answerUnresolved: false,
    });
    expect(warnings).toEqual([]);
  });

  it('captures an explanation for every option, not just the correct one', () => {
    // The whole point of this format: a candidate must learn why each
    // distractor fails, not only why one option succeeds.
    const { questions } = parseDocxText(q(1, 'c'));
    expect(questions[0].optionExplanations).toEqual([
      'reason A', 'reason B', 'reason C', 'reason D',
    ]);
  });

  it('strips the "because" boilerplate from the correct option', () => {
    const { questions } = parseDocxText(q(1, 'a'));
    expect(questions[0].optionExplanations[0]).toBe('reason A');
    expect(questions[0].explanation).toBe('reason A');
  });

  it('parses many questions in sequence', () => {
    const { questions } = parseDocxText(q(1, 'a') + q(2, 'b') + q(3, 'd'));
    expect(questions.map((x) => x.correctOptionIndex)).toEqual([0, 1, 3]);
    expect(questions.map((x) => x.number)).toEqual([1, 2, 3]);
  });

  it('accepts en dash, em dash and hyphen as the verdict separator', () => {
    for (const dash of ['—', '–', '-']) {
      const doc = `Q1. Which?\n(a) A\n(b) B\n(c) C\n(d) D\nExplanation:\n(a) A ${dash} Correct: yes\n(b) B ${dash} Incorrect: no\n(c) C ${dash} Incorrect: no\n(d) D ${dash} Incorrect: no\n`;
      expect(parseDocxText(doc).questions[0].correctOptionIndex).toBe(0);
    }
  });

  it('joins a question stem that wraps across lines', () => {
    const doc = `Q1. This stem is long\nand continues here.\n(a) A\n(b) B\n(c) C\n(d) D\nExplanation:\n(a) A — Correct: yes\n(b) B — Incorrect: no\n(c) C — Incorrect: no\n(d) D — Incorrect: no\n`;
    expect(parseDocxText(doc).questions[0].text).toBe('This stem is long and continues here.');
  });

  it('ignores preamble and section headings', () => {
    const doc = `NISM-Series-XV\nInstructions\nAttempt under exam conditions.\nSECTION A: Multiple Choice Questions (80 Questions x 1 Mark)\n${q(1, 'a')}`;
    expect(parseDocxText(doc).questions).toHaveLength(1);
  });
});

describe('parseDocxText — header metadata', () => {
  it('reads duration, pass mark and negative marking from the header', () => {
    const doc = `
Assessment Structure
Total Questions: 100 (80 standalone MCQs + 5 cases × 4 questions)
Time Allowed: 2 hours (120 minutes)
Passing Score: 60% (60 marks out of 100)
Negative Marking: 25% of the marks assigned to a question is deducted for each wrong answer
${q(1, 'a')}`;
    expect(parseDocxText(doc).meta).toMatchObject({
      totalQuestions: 100, durationMinutes: 120, passPercent: 60, negativeMarkPercent: 25,
    });
  });

  it('warns when the header count disagrees with what was parsed', () => {
    const doc = `Total Questions: 5\n${q(1, 'a')}`;
    expect(parseDocxText(doc).warnings.join(' ')).toMatch(/says 5 questions but 1 were parsed/);
  });

  it('returns empty metadata when the header is absent', () => {
    expect(parseDocxText(q(1, 'a')).meta).toEqual({});
  });
});

describe('parseDocxText — Section B case studies', () => {
  const caseDoc = `
SECTION B: Case-Based Questions (5 Cases × 4 Questions = 20 Marks)
CASE 1: Integrated Financial Analysis
You are an analyst covering XYZ Ltd. Revenue: 8,000. Net Profit: 448.
Shares outstanding: 80 crore.
${q(81, 'b')}
${q(82, 'a')}
CASE 2: Portfolio Construction
A client holds a concentrated portfolio.
${q(85, 'c')}
`;

  it('groups questions under the case that precedes them', () => {
    const { questions, cases } = parseDocxText(caseDoc);
    expect(cases).toHaveLength(2);
    expect(cases[0]).toMatchObject({ id: 'case-1', title: 'Integrated Financial Analysis', questionCount: 2 });
    expect(cases[1]).toMatchObject({ id: 'case-2', questionCount: 1 });

    expect(questions.filter((x) => x.caseId === 'case-1').map((x) => x.number)).toEqual([81, 82]);
    expect(questions.filter((x) => x.caseId === 'case-2').map((x) => x.number)).toEqual([85]);
  });

  it('captures the passage and attaches it to each of its questions', () => {
    const { questions, cases } = parseDocxText(caseDoc);
    expect(cases[0].passage).toContain('XYZ Ltd');
    expect(cases[0].passage).toContain('80 crore');
    expect(questions[0].casePassage).toBe(cases[0].passage);
    expect(questions[0].caseTitle).toBe('Integrated Financial Analysis');
  });

  it('leaves standalone Section A questions unlinked', () => {
    const doc = `SECTION A: MCQs\n${q(1, 'a')}\n${caseDoc}`;
    const { questions } = parseDocxText(doc);
    expect(questions.find((x) => x.number === 1)?.caseId).toBeNull();
    expect(questions.find((x) => x.number === 81)?.caseId).toBe('case-1');
  });

  it('warns about a case with no questions', () => {
    const doc = `SECTION B: Cases\nCASE 1: Orphan\nA passage with no questions after it.\n`;
    expect(parseDocxText(doc).warnings.join(' ')).toMatch(/no questions attached/);
  });
});

describe('parseDocxText — content defects', () => {
  it('does NOT guess an answer when no option is marked Correct', () => {
    // The format states the answer only inside the explanation block. With no
    // "Correct" marker there is nothing to recover, and inventing one would
    // silently give a whole paper an answer key of "A".
    const doc = `Q7. Which?\n(a) A\n(b) B\n(c) C\n(d) D\nExplanation:\n(a) A — Incorrect: no\n(b) B — Incorrect: no\n(c) C — Incorrect: no\n(d) D — Incorrect: no\n`;
    const { questions, warnings } = parseDocxText(doc);
    expect(questions[0].answerUnresolved).toBe(true);
    expect(warnings.join(' ')).toMatch(/Q7: NO option is marked "Correct"/);
  });

  it('flags an option whose verdict carries no reason', () => {
    // Seen verbatim in the real paper: "(a) Rs. 780 — Incorrect:" with nothing.
    const doc = `Q3. Which?\n(a) A\n(b) B\n(c) C\n(d) D\nExplanation:\n(a) A — Incorrect: \n(b) B — Correct: because yes\n(c) C — Incorrect: no\n(d) D — Incorrect: no\n`;
    const { warnings } = parseDocxText(doc);
    expect(warnings.join(' ')).toMatch(/Q3: option \(a\) is marked Incorrect but gives no reason/);
  });

  it('flags an option with no explanation line at all', () => {
    const doc = `Q4. Which?\n(a) A\n(b) B\n(c) C\n(d) D\nExplanation:\n(a) A — Correct: yes\n(b) B — Incorrect: no\n`;
    expect(parseDocxText(doc).warnings.join(' ')).toMatch(/option \(c\) has no explanation line/);
  });

  it('warns and pads when fewer than four options are given', () => {
    const doc = `Q5. Which?\n(a) A\n(b) B\nExplanation:\n(a) A — Correct: yes\n(b) B — Incorrect: no\n`;
    const { questions, warnings } = parseDocxText(doc);
    expect(questions[0].options).toHaveLength(4);
    expect(warnings.join(' ')).toMatch(/only 2 options found/);
  });

  it('takes the first when two options are both marked Correct', () => {
    const doc = `Q6. Which?\n(a) A\n(b) B\n(c) C\n(d) D\nExplanation:\n(a) A — Correct: yes\n(b) B — Correct: also yes\n(c) C — Incorrect: no\n(d) D — Incorrect: no\n`;
    const { questions, warnings } = parseDocxText(doc);
    expect(questions[0].correctOptionIndex).toBe(0);
    expect(warnings.join(' ')).toMatch(/more than one option is marked Correct/);
  });

  it('reports an empty document rather than returning silently', () => {
    expect(parseDocxText('').questions).toEqual([]);
    expect(parseDocxText('').warnings.join(' ')).toMatch(/No questions were found/);
    expect(parseDocxText('Just prose.').warnings.join(' ')).toMatch(/No questions were found/);
  });
});
