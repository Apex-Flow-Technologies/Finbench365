/**
 * Question-bank parser for the locked-in MyExams365 mock-test document format.
 *
 * Expected shape (see NISM-XV-RA_Mock_Test_1):
 *
 *   Total Questions: 100 ...
 *   Time Allowed: 2 hours (120 minutes)
 *   Passing Score: 60% ...
 *   Negative Marking: 25% ...
 *
 *   SECTION A: Multiple Choice Questions (80 Questions x 1 Mark)
 *   Q1. <question text>
 *   (a) <option>
 *   (b) <option>
 *   (c) <option>
 *   (d) <option>
 *   Explanation:
 *   (a) <option text> — Incorrect: <reason>
 *   (b) <option text> — Correct: because <reason>
 *   ...
 *
 *   SECTION B: Case-Based Questions (5 Cases × 4 Questions)
 *   CASE 1: <case title>
 *   <case passage — may run to several paragraphs>
 *   Q81. <question>            ← belongs to CASE 1, as do the following Qs
 *   ...
 *
 * Two properties of this format drive the whole implementation:
 *
 *  1. THE CORRECT ANSWER IS NOT STATED SEPARATELY. There is no "Answer: b)"
 *     line. The correct option is the one whose explanation says "Correct".
 *     Everything therefore hinges on parsing the explanation block, and a
 *     question whose block is missing or malformed has NO recoverable answer —
 *     which is reported, never guessed at.
 *
 *  2. EVERY OPTION CARRIES ITS OWN EXPLANATION, right or wrong. That is the
 *     pedagogical point of the format — a candidate should learn why the three
 *     distractors fail, not only why one option succeeds — so a missing or
 *     empty per-option reason is a content defect worth surfacing.
 */

export interface ParsedQuestion {
  /** Question number as printed in the document, for traceable warnings. */
  number: number | null;
  text: string;
  /** Always four entries; short papers are padded and reported. */
  options: string[];
  /**
   * Why each option is right or wrong, index-aligned with `options`.
   * SECRET — reveals the answer, so this is stored in the protected
   * `solutions` subcollection, never on the publicly readable question.
   */
  optionExplanations: string[];
  correctOptionIndex: number;
  /** The correct option's reasoning. Kept for the existing single-explanation UI. */
  explanation: string;
  difficulty: 'standard' | 'hard';
  /** True when no option was marked Correct and the index is a fallback. */
  answerUnresolved?: boolean;
  /** Set for Section B questions; groups them under a shared passage. */
  caseId?: string | null;
  caseTitle?: string | null;
  casePassage?: string | null;
}

export interface ParsedCase {
  id: string;
  title: string;
  passage: string;
  questionCount: number;
}

export interface ParsedMeta {
  totalQuestions?: number;
  durationMinutes?: number;
  passPercent?: number;
  negativeMarkPercent?: number;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  cases: ParsedCase[];
  /** Exam configuration read from the document header, when present. */
  meta: ParsedMeta;
  /** Content problems for whoever ran the import. */
  warnings: string[];
}

const OPTION_LETTERS = ['a', 'b', 'c', 'd'] as const;

/** `Q12.` / `Q12)` / `Q 12.` at the start of a line. */
const RE_QUESTION = /^Q\s*(\d+)\s*[.):]\s*(.*)$/i;
/** `(a) text` or `a) text` at the start of a line. */
const RE_OPTION = /^\(?([a-d])\)\s*(.*)$/i;
/** The `Explanation:` divider. */
const RE_EXPLANATION_HEADER = /^explanation\s*:?\s*$/i;
/** `CASE 3: Title` */
const RE_CASE = /^CASE\s+(\d+)\s*[:.]?\s*(.*)$/i;
/** `SECTION B: ...` */
const RE_SECTION = /^SECTION\s+([A-Z])\s*[:.]?\s*(.*)$/i;

/**
 * Splits an explanation line into its verdict and reasoning.
 *
 * Real documents use an em dash, en dash or hyphen between the restated option
 * and the verdict, and the verdict itself appears as "Correct:", "Incorrect:",
 * or occasionally without the colon. Accepting all of them is cheaper than
 * asking content authors to normalise punctuation by hand.
 */
function parseVerdict(line: string): { isCorrect: boolean; reason: string } | null {
  const m = line.match(/[—–-]\s*(correct|incorrect)\s*:?\s*(.*)$/i);
  if (!m) return null;
  return {
    isCorrect: m[1].toLowerCase() === 'correct',
    // "because" is boilerplate in this format and adds nothing for a reader.
    reason: m[2].trim().replace(/^because[:,]?\s*/i, '').trim(),
  };
}

/** Reads exam configuration out of the document header. */
function parseMeta(lines: string[]): ParsedMeta {
  const meta: ParsedMeta = {};
  const head = lines.slice(0, 40).join('\n');

  const duration = head.match(/Time\s+Allowed\s*:.*?(\d+)\s*minutes/i);
  if (duration) meta.durationMinutes = parseInt(duration[1], 10);

  const pass = head.match(/Passing\s+Score\s*:\s*(\d+(?:\.\d+)?)\s*%/i);
  if (pass) meta.passPercent = parseFloat(pass[1]);

  const negative = head.match(/Negative\s+Marking\s*:\s*(\d+(?:\.\d+)?)\s*%/i);
  if (negative) meta.negativeMarkPercent = parseFloat(negative[1]);

  const total = head.match(/Total\s+Questions\s*:\s*(\d+)/i);
  if (total) meta.totalQuestions = parseInt(total[1], 10);

  return meta;
}

interface Block {
  number: number | null;
  textLines: string[];
  optionLines: Map<string, string[]>;
  explanationLines: Map<string, string[]>;
  caseId: string | null;
}

export function parseDocxText(rawText: string): ParseResult {
  const warnings: string[] = [];
  const lines = rawText
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/ /g, ' ').trimEnd());

  const meta = parseMeta(lines);

  const cases = new Map<string, { title: string; passageLines: string[]; count: number }>();
  const blocks: Block[] = [];

  let currentCase: string | null = null;
  let block: Block | null = null;
  // Where subsequent text belongs: the question stem, an option, or an
  // explanation entry. Tracked so a stem or reason that wraps onto the next
  // line is appended rather than dropped.
  let mode: 'idle' | 'question' | 'option' | 'explanation' = 'idle';
  let currentLetter: string | null = null;

  const flush = () => { if (block) { blocks.push(block); block = null; } };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const sectionMatch = line.match(RE_SECTION);
    if (sectionMatch && !RE_QUESTION.test(line)) {
      flush();
      // Leaving Section B ends the current case.
      if (sectionMatch[1].toUpperCase() !== 'B') currentCase = null;
      mode = 'idle';
      continue;
    }

    const caseMatch = line.match(RE_CASE);
    if (caseMatch) {
      flush();
      currentCase = `case-${caseMatch[1]}`;
      cases.set(currentCase, { title: caseMatch[2].trim() || `Case ${caseMatch[1]}`, passageLines: [], count: 0 });
      mode = 'idle';
      continue;
    }

    const questionMatch = line.match(RE_QUESTION);
    if (questionMatch) {
      flush();
      block = {
        number: parseInt(questionMatch[1], 10),
        textLines: questionMatch[2] ? [questionMatch[2]] : [],
        optionLines: new Map(),
        explanationLines: new Map(),
        caseId: currentCase,
      };
      if (currentCase) cases.get(currentCase)!.count += 1;
      mode = 'question';
      currentLetter = null;
      continue;
    }

    // Any prose between a CASE heading and its first question is the passage.
    if (!block && currentCase) {
      cases.get(currentCase)!.passageLines.push(line);
      continue;
    }
    if (!block) continue;

    if (RE_EXPLANATION_HEADER.test(line)) {
      mode = 'explanation';
      currentLetter = null;
      continue;
    }

    const optionMatch = line.match(RE_OPTION);
    if (optionMatch) {
      const letter = optionMatch[1].toLowerCase();
      const rest = optionMatch[2];
      if (mode === 'explanation') {
        currentLetter = letter;
        block.explanationLines.set(letter, [rest]);
      } else {
        currentLetter = letter;
        mode = 'option';
        block.optionLines.set(letter, [rest]);
      }
      continue;
    }

    // Continuation of whatever was last opened.
    if (mode === 'explanation' && currentLetter) block.explanationLines.get(currentLetter)!.push(line);
    else if (mode === 'option' && currentLetter) block.optionLines.get(currentLetter)!.push(line);
    else if (mode === 'question') block.textLines.push(line);
  }
  flush();

  const questions: ParsedQuestion[] = blocks.map((b) => {
    const label = `Q${b.number ?? '?'}`;
    const text = b.textLines.join(' ').trim();
    if (!text) warnings.push(`${label}: question text is empty.`);

    const options: string[] = [];
    const optionExplanations: string[] = [];
    let correctOptionIndex = -1;

    OPTION_LETTERS.forEach((letter, i) => {
      const optText = (b.optionLines.get(letter) ?? []).join(' ').trim();
      options.push(optText);

      const rawExp = (b.explanationLines.get(letter) ?? []).join(' ').trim();
      const verdict = rawExp ? parseVerdict(rawExp) : null;

      if (verdict) {
        if (verdict.isCorrect) {
          if (correctOptionIndex !== -1) {
            warnings.push(`${label}: more than one option is marked Correct — using the first.`);
          } else {
            correctOptionIndex = i;
          }
        }
        optionExplanations.push(verdict.reason);
        // The format exists so a candidate learns why each distractor fails.
        if (!verdict.reason) {
          warnings.push(`${label}: option (${letter}) is marked ${verdict.isCorrect ? 'Correct' : 'Incorrect'} but gives no reason.`);
        }
      } else {
        optionExplanations.push('');
        if (optText) warnings.push(`${label}: option (${letter}) has no explanation line.`);
      }
    });

    const presentCount = options.filter((o) => o).length;
    if (presentCount < 4) {
      warnings.push(`${label}: only ${presentCount} option${presentCount === 1 ? '' : 's'} found — padded to 4 with blanks.`);
    }

    const answerUnresolved = correctOptionIndex === -1;
    if (answerUnresolved) {
      // No fabricated answer key. The question is flagged, defaulted to A only
      // so the editor can render it, and the author has to resolve it.
      warnings.push(`${label}: NO option is marked "Correct" — the answer could not be determined. Set it manually before saving.`);
    }

    const resolvedIndex = answerUnresolved ? 0 : correctOptionIndex;
    const c = b.caseId ? cases.get(b.caseId) : null;

    return {
      number: b.number,
      text,
      options,
      optionExplanations,
      correctOptionIndex: resolvedIndex,
      explanation: optionExplanations[resolvedIndex] ?? '',
      difficulty: 'standard' as const,
      answerUnresolved,
      caseId: b.caseId,
      caseTitle: c?.title ?? null,
      casePassage: c ? c.passageLines.join('\n\n').trim() : null,
    };
  });

  const parsedCases: ParsedCase[] = [...cases.entries()].map(([id, c]) => {
    const passage = c.passageLines.join('\n\n').trim();
    if (!passage) warnings.push(`${c.title}: the case has no passage text.`);
    if (c.count === 0) warnings.push(`${c.title}: the case has no questions attached.`);
    return { id, title: c.title, passage, questionCount: c.count };
  });

  if (questions.length === 0) {
    warnings.push('No questions were found. Check the document uses the "Q1." and "(a)" format.');
  } else if (meta.totalQuestions && meta.totalQuestions !== questions.length) {
    // The header is a stated intent; a mismatch usually means a malformed block
    // swallowed a question, which is worth knowing before publishing.
    warnings.push(`Header says ${meta.totalQuestions} questions but ${questions.length} were parsed.`);
  }

  return { questions, cases: parsedCases, meta, warnings };
}
