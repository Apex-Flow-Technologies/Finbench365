/**
 * The sample questions shown in the landing-page carousel.
 *
 * These were CFA Level I/II and FRM Part I questions, complete with CFA
 * "LOS" references, on a site that sells NISM preparation. Wrong on two
 * counts: it advertised a syllabus this platform does not teach, and it used
 * third-party certification marks there is no licence to use.
 *
 * Replaced with NISM questions supplied by the client. Keep it that way — a
 * sample question is the one piece of content a visitor judges the product on,
 * so it must come from the syllabus actually being sold.
 */
export interface SandboxQuestion {
  id: string;
  /** NISM series the question belongs to. */
  track: string;
  topic: string;
  /** Syllabus area, in NISM's own language. */
  los: string;
  difficulty: 'Foundation' | 'Exam Fidelity' | 'Advanced Case';
  timeEstimateSeconds: number;
  questionText: string;
  options: {
    label: 'A' | 'B' | 'C' | 'D';
    text: string;
    isCorrect: boolean;
    explanation: string;
  }[];
  /** Worked solution, shown once the candidate has answered. */
  correctFormulaBreakdown?: string;
}

export const SANDBOX_QUESTIONS: SandboxQuestion[] = [
  {
    id: 'nism-xv-capm-01',
    track: 'NISM Series XV',
    topic: 'Research Analyst • Cost of Equity',
    los: 'Valuation: estimating the cost of equity using the Capital Asset Pricing Model.',
    difficulty: 'Exam Fidelity',
    timeEstimateSeconds: 75,
    questionText:
      "An analyst wants to calculate the cost of equity for a stock using CAPM. The risk-free rate is 6%, "
      + "the expected market return is 14%, and the stock's beta is 1.2. What is the cost of equity?",
    correctFormulaBreakdown:
      'Cost of Equity (CAPM) = Rf + β × (Rm − Rf)\n'
      + '= 6% + 1.2 × (14% − 6%)\n'
      + '= 6% + 1.2 × 8%\n'
      + '= 6% + 9.6%\n'
      + '= 15.6%',
    options: [
      {
        label: 'A', text: '14.0%', isCorrect: false,
        explanation: 'This is the expected market return on its own. It ignores both the risk-free rate and the stock’s beta.',
      },
      {
        label: 'B', text: '15.6%', isCorrect: true,
        explanation:
          'Correct. Using CAPM: Cost of Equity = Risk-free rate + Beta × (Market return − Risk-free rate) '
          + '= 6% + 1.2 × (14% − 6%) = 6% + 9.6% = 15.6%.',
      },
      {
        label: 'C', text: '20.0%', isCorrect: false,
        explanation: 'This adds the full market return to the risk-free rate. The formula applies beta to the market risk premium, not to the whole return.',
      },
      {
        label: 'D', text: '9.6%', isCorrect: false,
        explanation: 'This is only the risk premium portion, β × (Rm − Rf). The risk-free rate still has to be added.',
      },
    ],
  },
  {
    id: 'nism-va-nav-01',
    track: 'NISM Series V-A',
    topic: 'Mutual Fund Distributors • Net Asset Value',
    los: 'Computing the NAV per unit of a scheme from its assets, liabilities and units outstanding.',
    difficulty: 'Foundation',
    timeEstimateSeconds: 60,
    questionText:
      'A mutual fund scheme has total assets of ₹50 crore, total liabilities of ₹2 crore, and 4.8 crore units '
      + 'outstanding. What is the NAV per unit of the scheme?',
    correctFormulaBreakdown:
      'NAV = (Total Assets − Total Liabilities) ÷ Units Outstanding\n'
      + '= (₹50 crore − ₹2 crore) ÷ 4.8 crore\n'
      + '= ₹48 crore ÷ 4.8 crore\n'
      + '= ₹10.00 per unit',
    options: [
      {
        label: 'A', text: '₹10.42', isCorrect: false,
        explanation: 'This divides total assets by units outstanding without first deducting the scheme’s liabilities.',
      },
      {
        label: 'B', text: '₹10.00', isCorrect: true,
        explanation:
          'Correct. NAV = (Total Assets − Total Liabilities) ÷ Number of units outstanding '
          + '= (₹50 crore − ₹2 crore) ÷ 4.8 crore units = ₹10.00 per unit.',
      },
      {
        label: 'C', text: '₹9.60', isCorrect: false,
        explanation: 'This deducts too much. Only the ₹2 crore of liabilities comes off the ₹50 crore of assets.',
      },
      {
        label: 'D', text: '₹12.00', isCorrect: false,
        explanation: 'This overstates net assets. ₹48 crore spread over 4.8 crore units is ₹10.00, not ₹12.00.',
      },
    ],
  },
  {
    id: 'nism-viii-total-return-01',
    track: 'NISM Series VIII',
    topic: 'Securities Markets Foundation • Total Return',
    los: 'Calculating an investor’s total return from capital gain together with dividend income.',
    difficulty: 'Foundation',
    timeEstimateSeconds: 60,
    questionText:
      'An investor buys a share at ₹200 and sells it after one year at ₹230, also receiving a ₹5 dividend per '
      + "share during the year. What is the investor's total return (%)?",
    correctFormulaBreakdown:
      'Total Return = (Capital Gain + Dividend) ÷ Purchase Price × 100\n'
      + '= (₹230 − ₹200 + ₹5) ÷ ₹200 × 100\n'
      + '= ₹35 ÷ ₹200 × 100\n'
      + '= 17.5%',
    options: [
      {
        label: 'A', text: '15.0%', isCorrect: false,
        explanation: 'This counts only the ₹30 capital gain. The ₹5 dividend is part of the return as well.',
      },
      {
        label: 'B', text: '17.5%', isCorrect: true,
        explanation:
          'Correct. Total Return = (Capital Gain + Dividend) ÷ Purchase Price × 100 '
          + '= (₹30 + ₹5) ÷ ₹200 × 100 = 17.5%.',
      },
      {
        label: 'C', text: '11.5%', isCorrect: false,
        explanation: 'This divides by the ₹230 sale price. Return is measured against what was invested, the ₹200 purchase price.',
      },
      {
        label: 'D', text: '12.5%', isCorrect: false,
        explanation: 'This understates the gain. ₹230 − ₹200 is ₹30, and with the ₹5 dividend the total is ₹35 on ₹200.',
      },
    ],
  },
];
