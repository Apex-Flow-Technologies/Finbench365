/**
 * Turns a case-study passage into readable blocks.
 *
 * Passages arrive from Word as a single unbroken run — the paragraph breaks the
 * author typed are lost, and even the spaces after colons go missing:
 *
 *   "…information is available:Balance Sheet (Rs. in Crores) as on March 31,
 *    2025:Equity Share Capital: 800 (Face Value Rs. 10)Reserves & Surplus:
 *    2,400Long-term Debt: 1,600…Income Statement (Rs. in Crores) for FY
 *    2024-25:Revenue: 8,000…"
 *
 * Shown as-is that is a wall of text a candidate has to decode before they can
 * even start the question. This finds the structure that is already in there —
 * section headings, and the label/value pairs beneath them — so it can be laid
 * out as cards.
 *
 * Deliberately heading-agnostic. "Balance Sheet" and "Income Statement" are
 * what this particular paper happens to use; the rules below key off SHAPE
 * (a phrase ending in a colon with no value after it) rather than off any
 * expected wording, so a paper about portfolio construction or KYC splits just
 * as well. Where no structure is found the passage is returned as prose rather
 * than being forced into a layout it does not fit.
 */

export interface CaseDatum {
  label: string;
  value: string;
}

export interface CaseBlock {
  /** Section heading, e.g. "Income Statement (Rs. in Crores) for FY 2024-25". */
  title: string;
  /** Label/value rows found under the heading. */
  items: CaseDatum[];
  /** Prose under the heading that was not a label/value pair. */
  notes: string[];
}

export interface ParsedCasePassage {
  /** Scene-setting text before the first heading. */
  intro: string;
  blocks: CaseBlock[];
  /** True when no structure was found and `intro` holds the whole passage. */
  isPlainProse: boolean;
}

/**
 * Restores the line breaks Word threw away.
 *
 * Two signals, both about shape rather than vocabulary:
 *   - a capitalised word butting straight up against the end of a value
 *     ("2,400Long-term", "Rs. 10)Reserves") — the next label started;
 *   - a colon with no space after it ("available:Balance") — a heading started.
 */
function restoreLineBreaks(text: string): string {
  if (text.includes('\n')) return text; // author's own breaks win

  return text
    // ")Reserves"  "2,400Long"  "16%Market"  ".Equity"
    // The `[A-Z]{2,}` arm matters: finance labels are full of acronyms, and
    // matching only Title Case silently swallowed "1,800EBIT: 800" into the
    // previous value — losing a figure the question then asked about.
    .replace(/([\d)%.,])(?=[A-Z][a-z]|[A-Z]{2,})/g, '$1\n')
    // "interest ratesUS Dollar", "have declinedGold ETF", "of goldDomestic
    // Factors", "festive seasonGold import".
    //
    // Passages whose points are sentences rather than figures run out of
    // punctuation entirely: the break lands between an ordinary lowercase word
    // and the capital that starts the next line. Without this the whole of a
    // "Global Factors" list collapsed into one item.
    .replace(/([a-z])(?=[A-Z][a-z]|[A-Z]{2,})/g, (m, _ch, offset: number, whole: string) => {
      // "eKYC", "iOS", "eNPS" — a lone lowercase letter opening a word belongs
      // to that word, and breaking there would invent a line that is one letter
      // long. Only a real word ending may be treated as a lost line break.
      if (/(?:^|[\s("'‘“])[a-z]$/.test(whole.slice(0, offset + 1))) return m;
      return `${m}\n`;
    })
    // "per USDDomestic gold demand" — an acronym butting into the next line.
    // Splits before the capitalised word, keeping the acronym whole.
    .replace(/([A-Z])(?=[A-Z][a-z])/g, '$1\n')
    // "available:Balance"  — but never "Share: Rs. 75", which has a space
    .replace(/:(?=[A-Z])/g, ':\n');
}

/** "Equity Share Capital: 800 (Face Value Rs. 10)" -> label + value */
function asDatum(line: string): CaseDatum | null {
  // The value must contain a digit; otherwise this is prose that happens to
  // have a colon in it, e.g. "Note: the analyst should consider…".
  const m = line.match(/^([^:]{1,60}):\s*(.+)$/);
  if (!m) return null;
  const [, label, value] = m;
  if (!/\d/.test(value)) return null;
  return { label: label.trim(), value: value.trim() };
}

/** A heading is a short phrase ending in a colon with nothing after it. */
function asHeading(line: string): string | null {
  if (!line.endsWith(':')) return null;
  const title = line.slice(0, -1).trim();
  if (!title || title.length > 90) return null;
  return title;
}

export function parseCasePassage(passage: string | null | undefined): ParsedCasePassage {
  const raw = (passage ?? '').trim();
  if (!raw) return { intro: '', blocks: [], isPlainProse: true };

  const lines = restoreLineBreaks(raw)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const introParts: string[] = [];
  const blocks: CaseBlock[] = [];
  let current: CaseBlock | null = null;

  for (const line of lines) {
    const heading = asHeading(line);
    if (heading) {
      current = { title: heading, items: [], notes: [] };
      blocks.push(current);
      continue;
    }

    const datum = asDatum(line);
    if (datum) {
      if (!current) {
        // Data before any heading — give it a home rather than dropping it.
        current = { title: 'Details', items: [], notes: [] };
        blocks.push(current);
      }
      current.items.push(datum);
      continue;
    }

    if (current) current.notes.push(line);
    else introParts.push(line);
  }

  // A block with nothing under it is a false positive: a sentence that merely
  // ended in a colon. Fold it back into the surrounding prose.
  const meaningful = blocks.filter((b) => b.items.length > 0 || b.notes.length > 0);
  const discarded = blocks.filter((b) => b.items.length === 0 && b.notes.length === 0);
  discarded.forEach((b) => introParts.push(`${b.title}:`));

  if (meaningful.length === 0) {
    return { intro: introParts.join(' ').trim() || raw, blocks: [], isPlainProse: true };
  }

  return {
    intro: introParts.join(' ').trim(),
    blocks: meaningful,
    isPlainProse: false,
  };
}
