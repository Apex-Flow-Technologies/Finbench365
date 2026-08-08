import React from 'react';

/**
 * Renders an explanation, breaking calculations onto their own lines.
 *
 * Numerical explanations arrive from the source documents as one long
 * paragraph:
 *
 *   "because: Ke = Rf + β × (Rm - Rf) = 6% + 1.4 × 7% = 15.8% Kd = 10% ×
 *    (1 - 0.30) = 7% We = 1,800 / 3,000 = 0.60 Wd = 1,200 / 3,000 = 0.40
 *    WACC = (15.8% × 0.60) + (7% × 0.40) = 12.28%"
 *
 * which is close to unreadable — a candidate cannot follow the working, and the
 * steps run into each other. Each calculation step is put on its own line, the
 * way it would be written out on paper.
 *
 * Purely presentational: the stored text is untouched, so nothing is lost and
 * prose explanations are left exactly as written.
 */
export function ExplanationBody({ text }: { text: string }) {
  const lines = splitIntoSteps(text);

  if (lines.length <= 1) {
    return <p className="text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed">{text}</p>;
  }

  return (
    <div className="space-y-1">
      {lines.map((line, i) => (
        <p
          key={i}
          className={`text-sm leading-relaxed ${
            /[=+×÷\-/]/.test(line) && /\d/.test(line)
              ? 'font-mono text-[13px] text-[#334155] dark:text-[#CBD5E1] tabular-nums'
              : 'text-[#475569] dark:text-[#94A3B8]'
          }`}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

/**
 * Splits an explanation into readable steps.
 *
 * A new step begins where a calculation ends and the next label starts — the
 * pattern is "…= <result> <NextLabel> =". Sentence ends and explicit newlines
 * are respected too. Conservative on purpose: when nothing matches, the text is
 * returned whole rather than chopped at arbitrary points.
 */
function splitIntoSteps(text: string): string[] {
  if (!text) return [];

  let s = text.trim();

  // Respect newlines the author already put in.
  if (s.includes('\n')) {
    return s.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  }

  // Only reformat when this actually looks like working, not prose.
  const equalsCount = (s.match(/=/g) ?? []).length;
  if (equalsCount < 2) return [s];

  // Break before a capitalised or symbolic term that starts the next step:
  //   "… = 15.8% Kd = 10% …"  ->  "… = 15.8%" | "Kd = 10% …"
  s = s.replace(
    /([\d%),.])\s+(?=(?:[A-Z][A-Za-z0-9]{0,14}|PV|NPV|EPS|ROE|WACC|D\d)\s*=)/g,
    '$1\n',
  );

  // Break after a sentence end that is followed by a new capitalised clause.
  s = s.replace(/\.\s+(?=[A-Z])/g, '.\n');

  // "Stage 1:", "Step 2:" and similar headings start their own line.
  s = s.replace(/\s+(?=(?:Stage|Step|Year|Part)\s+\d+\s*:)/g, '\n');

  return s.split('\n').map((l) => l.trim()).filter(Boolean);
}
