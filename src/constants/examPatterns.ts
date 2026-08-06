/**
 * Official NISM exam patterns.
 *
 * Source: the "NISM Exam Patterns" sheet of the MyExams365 Team & Developer
 * Checklist, itself taken from nism.ac.in/certifications.
 *
 * These are REFERENCE DEFAULTS used to seed a new mock test in the editor. They
 * are not what grading reads — the authoritative values live on each
 * `mock_tests` document, so an admin can override them per test without a code
 * change. See `resolveExamPattern()` in lib/exams/scoring.ts.
 */

export interface NismExamPattern {
  /** NISM series code, e.g. 'V-A'. */
  series: string;
  name: string;
  /** Plain-language description of who the exam is for, shown on the storefront. */
  description: string;
  durationMinutes: number;
  /** 1 mark per question across every series currently in scope. */
  maxMarks: number;
  passPercent: number;
  /**
   * Deducted per WRONG answer, as a percentage of that question's mark value.
   * 25 on a 1-mark question means -0.25. Unattempted questions are never
   * penalised. 0 means the series has no negative marking.
   */
  negativeMarkPercent: number;
  /** Whether we currently sell preparation for this exam. */
  inScope: boolean;
}

export const NISM_EXAM_PATTERNS: NismExamPattern[] = [
  { series: 'V-A', name: 'Mutual Fund Distributors', description: 'The core certification required to sell and distribute mutual funds in India.',                              durationMinutes: 120, maxMarks: 100, passPercent: 50, negativeMarkPercent: 0,  inScope: true },
  { series: 'V-B', name: 'Mutual Fund Foundation', description: 'A beginner-friendly starting point for anyone new to mutual fund distribution.',                                durationMinutes: 120, maxMarks: 50,  passPercent: 50, negativeMarkPercent: 0,  inScope: true },
  { series: 'V-D', name: 'Mutual Fund — Specialized Investment Fund Distributors', description: 'Required if you want to distribute Specialized Investment Funds (SIFs).', durationMinutes: 180, maxMarks: 150, passPercent: 60, negativeMarkPercent: 10, inScope: true },
  { series: 'XV', name: 'Research Analyst', description: 'Mandatory for anyone wanting to work as a SEBI-registered research analyst.',                                      durationMinutes: 120, maxMarks: 100, passPercent: 60, negativeMarkPercent: 25, inScope: true },
  { series: 'XIII', name: 'Common Derivatives (combined exam)', description: 'The combined derivatives exam, covering equity, currency and interest rate products.',                    durationMinutes: 180, maxMarks: 150, passPercent: 60, negativeMarkPercent: 25, inScope: true },
  { series: 'I', name: 'Currency Derivatives', description: 'For those looking to trade or advise on currency derivative products.',                                  durationMinutes: 120, maxMarks: 100, passPercent: 60, negativeMarkPercent: 25, inScope: true },
  { series: 'IV', name: 'Interest Rate Derivatives', description: 'For those dealing in interest rate derivative products in the market.',                             durationMinutes: 120, maxMarks: 100, passPercent: 60, negativeMarkPercent: 25, inScope: true },
  { series: 'VIII', name: 'Equity Derivatives', description: 'For those looking to trade or advise on equity derivative products.',                                    durationMinutes: 120, maxMarks: 100, passPercent: 60, negativeMarkPercent: 25, inScope: true },
  { series: 'XII', name: 'Securities Markets Foundation', description: 'A foundational exam covering how the securities market works overall.',                         durationMinutes: 120, maxMarks: 100, passPercent: 60, negativeMarkPercent: 0,  inScope: true },
  { series: 'X-A', name: 'Investment Adviser (Level 1)', description: 'The first step to becoming a SEBI-registered investment adviser.',                          durationMinutes: 180, maxMarks: 150, passPercent: 60, negativeMarkPercent: 25, inScope: false },
  { series: 'X-B', name: 'Investment Adviser (Level 2)', description: 'The advanced level for advisers, covering deeper financial planning skills.',                          durationMinutes: 180, maxMarks: 150, passPercent: 60, negativeMarkPercent: 25, inScope: false },
  { series: 'XIX-A', name: 'AIF (Category I & II) Distributors', description: 'Required to distribute Category I & II Alternative Investment Funds.',                    durationMinutes: 120, maxMarks: 100, passPercent: 60, negativeMarkPercent: 10, inScope: false },
  { series: 'XIX-B', name: 'AIF (Category III) Distributors', description: 'Required to distribute Category III Alternative Investment Funds.',                       durationMinutes: 120, maxMarks: 100, passPercent: 60, negativeMarkPercent: 10, inScope: false },
  { series: 'XIX-C', name: 'AIF Managers', description: 'For managers of Alternative Investment Funds.',                                          durationMinutes: 180, maxMarks: 150, passPercent: 60, negativeMarkPercent: 25, inScope: false },
  { series: 'XIX-D', name: 'AIF (Category I & II) Managers', description: 'For managers of Category I & II Alternative Investment Funds.',                        durationMinutes: 120, maxMarks: 100, passPercent: 60, negativeMarkPercent: 25, inScope: false },
  { series: 'XIX-E', name: 'AIF (Category III) Managers', description: 'For managers of Category III Alternative Investment Funds.',                           durationMinutes: 120, maxMarks: 100, passPercent: 60, negativeMarkPercent: 25, inScope: false },
];

export function findExamPattern(series: string | undefined | null): NismExamPattern | null {
  if (!series) return null;
  const key = series.trim().toUpperCase();
  return NISM_EXAM_PATTERNS.find((p) => p.series.toUpperCase() === key) ?? null;
}

/** The series we currently sell, for the editor's dropdown and the storefront. */
export const IN_SCOPE_PATTERNS = NISM_EXAM_PATTERNS.filter((p) => p.inScope);
