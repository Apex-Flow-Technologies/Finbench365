export interface SandboxQuestion {
  id: string;
  track: 'CFA Level I' | 'CFA Level II' | 'FRM Part I' | 'Quantitative Finance' | 'Fixed Income & Derivatives';
  topic: string;
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
  correctFormulaBreakdown?: string;
}

export const SANDBOX_QUESTIONS: SandboxQuestion[] = [
  {
    id: 'cfa-l1-quant-01',
    track: 'CFA Level I',
    topic: 'Quantitative Methods • Time Value of Money & Fixed Income',
    los: 'LOS 4.b: Calculate and interpret the Macaulay duration and modified duration of a bond.',
    difficulty: 'Exam Fidelity',
    timeEstimateSeconds: 90,
    questionText: 'A corporate analyst is evaluating a 5-year, $1,000 par value annual-pay coupon bond that carries a 6.00% coupon rate. If the current market yield to maturity (YTM) is exactly 6.00% (so the bond trades at par, $1,000), what is the Macaulay duration and Modified duration of this bond, respectively?',
    correctFormulaBreakdown: 'Macaulay Duration (MacD) = ∑ [t × PV(CF_t)] / Price = ($56.60 + $106.80 + $150.84 + $189.64 + $3,948.33) / $1,000 = 4.4651 years. Modified Duration (ModD) = MacD / (1 + YTM) = 4.4651 / 1.06 = 4.2124 years.',
    options: [
      {
        label: 'A',
        text: 'Macaulay Duration: 4.47 years; Modified Duration: 4.21 years',
        isCorrect: true,
        explanation: 'Correct! Since the bond trades at par at a 6.00% yield, the Macaulay duration is weighted by discounted cash flows yielding 4.465 years. Dividing by (1 + 0.06) yields exactly 4.212 years.'
      },
      {
        label: 'B',
        text: 'Macaulay Duration: 5.00 years; Modified Duration: 4.72 years',
        isCorrect: false,
        explanation: 'Incorrect. A bond only has a Macaulay duration equal to its maturity (5.00 years) if it is a zero-coupon bond. Because coupon payments are received earlier (years 1 through 4), the effective weighted average maturity is strictly less than 5 years.'
      },
      {
        label: 'C',
        text: 'Macaulay Duration: 4.21 years; Modified Duration: 4.47 years',
        isCorrect: false,
        explanation: 'Incorrect. This option mistakenly reverses the definitions. Macaulay duration represents the weighted average time (in years), whereas Modified duration equals Macaulay duration divided by (1 + YTM/k), meaning Modified duration must always be smaller than Macaulay duration when YTM > 0.'
      },
      {
        label: 'D',
        text: 'Macaulay Duration: 4.47 years; Modified Duration: 4.47 years',
        isCorrect: false,
        explanation: 'Incorrect. Macaulay duration and Modified duration only equal each other when the yield to maturity is exactly zero (0.00%). With a 6.00% discount rate, discounting MacD by 1.06 is mathematically required to derive percentage price sensitivity.'
      }
    ]
  },
  {
    id: 'frm-p1-var-02',
    track: 'FRM Part I',
    topic: 'Valuation & Risk Models • Value at Risk (VaR)',
    los: 'Topic 56: Parametric vs. Non-Parametric Value at Risk and Expected Shortfall.',
    difficulty: 'Exam Fidelity',
    timeEstimateSeconds: 105,
    questionText: 'A financial institution holds a diversified equity portfolio valued at USD 50,000,000. Daily portfolio returns are normally distributed with a daily mean return of 0.04% and a daily standard deviation of 1.35%. Assuming 250 trading days per year and using the parametric normal distribution method, calculate the 10-day 99% Value at Risk (VaR) in dollar terms. (Use z_0.99 = 2.326).',
    correctFormulaBreakdown: '1-day 99% VaR (%) = -Mean + z × σ = -0.04% + 2.326 × 1.35% = -0.04% + 3.1401% = 3.1001%. In dollar terms: 1-day VaR = $50M × 3.1001% = $1,550,050. Scaling to 10 days via square-root-of-time rule (assuming i.i.d. returns): 10-day VaR = $1,550,050 × √10 = $4,901,688 ≈ USD 4.90M.',
    options: [
      {
        label: 'A',
        text: 'USD 1.55 Million',
        isCorrect: false,
        explanation: 'Incorrect. USD 1.55 Million represents only the 1-day 99% VaR. The question specifically asks for the 10-day VaR, which requires scaling the volatility component by √10 (or approximately 3.162).'
      },
      {
        label: 'B',
        text: 'USD 4.90 Million',
        isCorrect: true,
        explanation: 'Correct! By calculating the 1-day parametric VaR minus the expected drift ($50M × [-0.0004 + 2.326 × 0.0135] = $1,550,050) and applying the √10 time-scaling factor under Basel III standards, we arrive at exactly $4,901,688 (USD 4.90M).'
      },
      {
        label: 'C',
        text: 'USD 5.11 Million',
        isCorrect: false,
        explanation: 'Incorrect. This figure is derived if you ignore the positive daily expected return (+0.04%) and scale only the pure volatility term (z × σ × √10). While some conservative regulatory frameworks ignore positive drift over multi-day horizons, standard exam calculations subtract expected mean return.'
      },
      {
        label: 'D',
        text: 'USD 15.50 Million',
        isCorrect: false,
        explanation: 'Incorrect. This error occurs when multiplying the 1-day VaR linearly by 10 days instead of √10. Variance scales linearly with time under i.i.d. assumptions, which means standard deviation (and VaR) scales by the square root of time (√T).'
      }
    ]
  },
  {
    id: 'cfa-l2-fsa-03',
    track: 'CFA Level II',
    topic: 'Financial Reporting & Analysis • Multinational Operations & Currency Translation',
    los: 'LOS 14.c: Compare and contrast the temporal method and the current rate method of translation.',
    difficulty: 'Advanced Case',
    timeEstimateSeconds: 120,
    questionText: 'SwissTech AG, a Swiss subsidiary of a U.S. multinational corporation, operates in Switzerland using the Swiss Franc (CHF) as its functional currency. The parent company reports in U.S. Dollars (USD). During the current fiscal year, the CHF depreciated by 8.5% against the USD. Under U.S. GAAP, which translation method must the parent use, and what is the exact accounting treatment for the resulting translation loss?',
    correctFormulaBreakdown: 'Since the subsidiary\'s functional currency (CHF) differs from the parent\'s presentation currency (USD) and Switzerland is not a hyperinflationary economy, the Current Rate Method is mandatory. Assets and liabilities translate at ending rate; income items at average rate. The net translation adjustment does not impact Net Income on the Income Statement; instead, it goes directly to Other Comprehensive Income (OCI) as Cumulative Translation Adjustment (CTA).',
    options: [
      {
        label: 'A',
        text: 'Current Rate Method; translation adjustment is reported in Net Income within operating expenses',
        isCorrect: false,
        explanation: 'Incorrect. While the Current Rate Method is the correct methodology, translation adjustments under this method bypass the income statement completely to prevent paper exchange rate volatility from distorting operating net income.'
      },
      {
        label: 'B',
        text: 'Temporal Method; translation adjustment is reported in Net Income as a foreign exchange loss',
        isCorrect: false,
        explanation: 'Incorrect. The Temporal Method is only required when the subsidiary\'s functional currency is the parent\'s reporting currency (USD) or when operating in a hyperinflationary economy (cumulative 3-year inflation > 100%).'
      },
      {
        label: 'C',
        text: 'Current Rate Method; translation adjustment is reported in Other Comprehensive Income (OCI) inside stockholders\' equity',
        isCorrect: true,
        explanation: 'Correct! Because CHF is the functional currency, the Current Rate Method applies. All balance sheet translation discrepancies are accumulated in stockholders\' equity under Other Comprehensive Income (OCI) as Cumulative Translation Adjustment (CTA) until disposal.'
      },
      {
        label: 'D',
        text: 'Temporal Method; translation adjustment is reported directly in retained earnings without passing through OCI',
        isCorrect: false,
        explanation: 'Incorrect. Under the Temporal Method, remeasurement gains or losses must pass directly through the Income Statement (affecting Net Income and subsequently Retained Earnings). Furthermore, Temporal is not applicable here.'
      }
    ]
  },
  {
    id: 'quant-it-derivatives-04',
    track: 'Fixed Income & Derivatives',
    topic: 'Derivatives Pricing • Black-Scholes-Merton Option Greeks & Delta Hedging',
    los: 'LOS 38.f: Calculate and interpret option Greeks (Delta, Gamma, Vega, Theta, Rho) and construct delta-neutral hedges.',
    difficulty: 'Advanced Case',
    timeEstimateSeconds: 110,
    questionText: 'An equity derivatives trader sells 100 call option contracts (each contract representing 100 shares, total 10,000 shares) on Apex Semiconductor stock. The call option currently has a Delta of +0.64 and a Gamma of +0.035. To establish an immediate dynamic delta-neutral hedge, what action must the trader execute, and what secondary risk remains if Apex stock suddenly surges by $4.00 overnight?',
    correctFormulaBreakdown: 'Short option position delta = -10,000 × (+0.64) = -6,400 share equivalents. To achieve delta neutrality (Total Delta = 0), the trader must purchase +6,400 shares of underlying stock. If the stock jumps +$4.00 overnight, the option delta increases by ΔS × Gamma = +$4.00 × 0.035 = +0.14 per option (new Delta ≈ 0.78). Because the short call Delta becomes more negative (-7,800), the existing +6,400 share hedge is now under-hedged by 1,400 shares, resulting in a net loss (negative Gamma exposure).',
    options: [
      {
        label: 'A',
        text: 'Buy 6,400 shares of stock; remains exposed to negative Gamma, causing losses on large price jumps due to convexity',
        isCorrect: true,
        explanation: 'Correct! Selling call options creates negative Delta (-6,400 shares) and negative Gamma. Buying 6,400 shares neutralizes instantaneous Delta. However, because the short position has negative Gamma, large upward price moves increase the call delta faster than the hedge, creating a net unhedged liability.'
      },
      {
        label: 'B',
        text: 'Sell 6,400 shares of stock; remains exposed to positive Gamma, generating extra profits if the stock surges',
        isCorrect: false,
        explanation: 'Incorrect. Selling shares would compound the negative Delta of the short call options (-6,400 from options - 6,400 from stock = -12,800 total Delta exposure). Furthermore, a short option seller is always short (negative) Gamma, not positive.'
      },
      {
        label: 'C',
        text: 'Buy 10,000 shares of stock; remains completely immunized against all price jumps regardless of magnitude',
        isCorrect: false,
        explanation: 'Incorrect. Buying 10,000 shares over-hedges the position because the option delta is 0.64 (not 1.00). Furthermore, delta-neutral hedging only immunizes against infinitesimal price changes; Gamma and Theta exposures remain active.'
      },
      {
        label: 'D',
        text: 'Buy 6,400 shares of stock; remains exposed to positive Vega, which offsets any stock price movements',
        isCorrect: false,
        explanation: 'Incorrect. Option sellers are short Vega (vulnerable to rising implied volatility), not positive Vega. More importantly, Vega measures sensitivity to volatility changes, whereas the $4.00 directional gap is primarily governed by Gamma (second-order price sensitivity).'
      }
    ]
  },
  {
    id: 'quant-finance-portfolio-05',
    track: 'Quantitative Finance',
    topic: 'Portfolio Theory • Treynor Measure, Sharpe Ratio & Information Ratio',
    los: 'LOS 52.a: Evaluate portfolio performance using absolute and relative risk-adjusted return metrics.',
    difficulty: 'Exam Fidelity',
    timeEstimateSeconds: 80,
    questionText: 'Portfolio X generated an annual return of 14.2% with an annualized standard deviation of 18.0% and a portfolio Beta of 1.25 against the S&P 500 index. The risk-free rate is exactly 4.2%. If the portfolio is a small, specialized equity sector carve-out held within a client\'s broader multi-asset portfolio (rather than their sole investment), which performance evaluation metric is most theoretically appropriate, and what is its exact value?',
    correctFormulaBreakdown: 'When a portfolio is a component of a well-diversified overall wealth portfolio, unsystematic (specific) risk is diversified away by the other holdings. Therefore, the relevant risk measure is systematic risk (Beta), making the Treynor Measure most appropriate. Treynor Ratio = (R_p - R_f) / Beta_p = (14.2% - 4.2%) / 1.25 = 10.0% / 1.25 = 8.00%. (By contrast, Sharpe Ratio = 10.0% / 18.0% = 0.556 penalizes for total risk, appropriate only when evaluating standalone total wealth).',
    options: [
      {
        label: 'A',
        text: 'Sharpe Ratio = 0.556; because standard deviation captures all historical tail risk across market cycles',
        isCorrect: false,
        explanation: 'Incorrect value and rationale for this specific institutional context. The Sharpe ratio uses total volatility (σ = 18.0%), which is appropriate for evaluating an investor\'s entire undivided portfolio. For a sub-portfolio inside a diversified fund, non-systematic volatility is diversified away.'
      },
      {
        label: 'B',
        text: 'Treynor Measure = 8.00%; because the portfolio is part of a broader diversified fund where idiosyncratic risk is diversified away',
        isCorrect: true,
        explanation: 'Correct! Since the carve-out is held within a broader diversified portfolio, systematic beta (1.25) is the relevant pricing factor. Treynor Measure = (14.2% - 4.2%) / 1.25 = 8.00% per unit of systematic risk.'
      },
      {
        label: 'C',
        text: 'Treynor Measure = 11.36%; calculated by dividing total return (14.2%) directly by portfolio Beta (1.25)',
        isCorrect: false,
        explanation: 'Incorrect. This calculation omits subtracting the risk-free rate (4.2%) from the numerator. The Treynor ratio measures excess return (risk premium earned over the risk-free benchmark) per unit of beta.'
      },
      {
        label: 'D',
        text: 'Information Ratio = 0.800; because it compares portfolio alpha directly against the tracking error',
        isCorrect: false,
        explanation: 'Incorrect. The Information Ratio equals active return divided by active risk (Tracking Error: σ of excess returns versus benchmark). The question provides total standard deviation and beta, but not the tracking error variance required for IR.'
      }
    ]
  }
];
