/**
 * Exam scoring, including negative marking.
 *
 * Pure and dependency-free on purpose: the launch checklist calls for manually
 * verifying the negative-marking maths against a known answer key, and this is
 * the piece that has to be right. Being pure means it is covered by unit tests
 * instead (see scoring.test.ts) rather than only by someone working through an
 * exam by hand.
 *
 * Marking rule, per the NISM pattern sheet: a wrong answer costs a percentage
 * of that question's own mark value (25% on a 1-mark question = -0.25).
 * An unattempted question is never penalised — that distinction is the whole
 * point of negative marking, and getting it wrong punishes candidates for
 * questions they correctly chose to skip.
 */

export interface ExamPatternConfig {
  /** Marks awarded per correct answer. */
  marksPerQuestion: number;
  /** Percentage of a question's marks deducted per wrong answer. 0 = none. */
  negativeMarkPercent: number;
  /** Percentage of max marks needed to pass. */
  passPercent: number;
}

export interface ScoreBreakdown {
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  /** Marks gained from correct answers, before any penalty. */
  marksEarned: number;
  /** Total deducted for wrong answers. Always >= 0. */
  marksDeducted: number;
  /** marksEarned - marksDeducted. Can be negative when negative marking is on. */
  score: number;
  maxMarks: number;
  /** score as a percentage of maxMarks, floored at 0 for display. */
  percentage: number;
  passed: boolean;
}

/**
 * Resolves the marking configuration for a test.
 *
 * Values come off the `mock_tests` document so an admin can set them per test.
 * Anything missing falls back to "no negative marking" — a test that has not
 * been configured must never silently start deducting marks from candidates.
 */
export function resolveExamPattern(testData: Record<string, any> | null | undefined): ExamPatternConfig {
  const num = (v: any, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  return {
    marksPerQuestion: Math.max(0, num(testData?.marksPerQuestion, 1)),
    // Clamped: a value outside 0–100 is a data-entry error, and letting it
    // through would produce scores nobody can explain to a candidate.
    negativeMarkPercent: Math.min(100, Math.max(0, num(testData?.negativeMarkPercent, 0))),
    passPercent: Math.min(100, Math.max(0, num(testData?.passPercent, 60))),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Grades an attempt.
 *
 * @param solutions   questionId -> correct option index (the full answer key,
 *                    which also defines how many questions the test has)
 * @param answers     questionId -> selected option index, for answered questions
 */
export function gradeAttempt(
  solutions: Map<string, number>,
  answers: Record<string, number>,
  config: ExamPatternConfig,
): ScoreBreakdown {
  let correctCount = 0;
  let wrongCount = 0;

  for (const [questionId, correctIndex] of solutions) {
    const selected = answers[questionId];

    // Absent, null and undefined all mean "not attempted". A plain falsy check
    // would misread option 0 — the first option — as unanswered.
    if (selected === undefined || selected === null) continue;

    if (selected === correctIndex) correctCount++;
    else wrongCount++;
  }

  const totalQuestions = solutions.size;
  const unattemptedCount = totalQuestions - correctCount - wrongCount;

  const marksEarned = correctCount * config.marksPerQuestion;
  const penaltyPerWrong = config.marksPerQuestion * (config.negativeMarkPercent / 100);
  const marksDeducted = wrongCount * penaltyPerWrong;

  const score = round2(marksEarned - marksDeducted);
  const maxMarks = round2(totalQuestions * config.marksPerQuestion);

  // Floored at 0: a negative percentage is meaningless to a candidate, and a
  // negative raw score is still recorded above for anyone auditing the maths.
  const percentage = maxMarks > 0 ? Math.max(0, round2((score / maxMarks) * 100)) : 0;

  return {
    correctCount,
    wrongCount,
    unattemptedCount,
    marksEarned: round2(marksEarned),
    marksDeducted: round2(marksDeducted),
    score,
    maxMarks,
    percentage,
    passed: percentage >= config.passPercent,
  };
}
