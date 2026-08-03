export interface ParsedQuestion {
  text: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  difficulty: 'standard' | 'hard';
  /**
   * Problems found while parsing this question. The importer shows these to the
   * author before anything is added to the bank.
   *
   * This exists because the parser has to guess. A question with no "Answer:"
   * line used to be imported with correctOptionIndex 0 — silently marking
   * option (a) correct — with no way for the author to tell the guess apart
   * from a real answer key. On a 100-question import that is dozens of
   * wrong answers shipped to paying candidates.
   */
  warnings?: string[];
}

export interface ParseResult {
  questions: ParsedQuestion[];
  /** Segments that looked like questions but could not be parsed at all. */
  skipped: number;
}

export function parseDocxText(rawText: string): ParsedQuestion[] {
  return parseDocxTextDetailed(rawText).questions;
}

export function parseDocxTextDetailed(rawText: string): ParseResult {
  const questions: ParsedQuestion[] = [];
  let skipped = 0;

  // Split by "Question X" or "Question X.Y"
  const rawSegments = rawText.split(/Question\s+\d+(?:\.\d+)?/i);

  // The first segment is usually preamble (before the first question), so we skip it if it doesn't contain options.
  for (let i = 1; i < rawSegments.length; i++) {
    const segment = rawSegments[i].trim();
    if (!segment) continue;

    try {
      const warnings: string[] = [];

      // 1. Extract Question Text (Everything before "a)")
      // We look for the first occurrence of "a)" at the start of a line or anywhere.
      const matchA = segment.match(/a\)\s+/i);
      if (!matchA) {
        // Not a valid question if it doesn't have options — but count it, so
        // the author is told their document had content we could not read.
        skipped++;
        continue;
      }

      const text = segment.substring(0, matchA.index).trim();
      let remaining = segment.substring(matchA.index!);

      if (!text) warnings.push('Question text is empty');

      // 2. Extract Options
      const options: string[] = [];
      const optionLetters = ['a', 'b', 'c', 'd'];

      let answerMatch = remaining.match(/Answer\s*:/i);
      let optionsText = answerMatch ? remaining.substring(0, answerMatch.index) : remaining;

      // Parse a), b), c), d)
      for (let j = 0; j < optionLetters.length; j++) {
        const currentLetter = optionLetters[j];
        const nextLetter = j < optionLetters.length - 1 ? optionLetters[j + 1] : null;

        const currentRegex = new RegExp(`${currentLetter}\\)\\s+`, 'i');
        const nextRegex = nextLetter ? new RegExp(`${nextLetter}\\)\\s+`, 'i') : null;

        const cMatch = optionsText.match(currentRegex);
        if (cMatch) {
          const startIdx = cMatch.index! + cMatch[0].length;
          let endIdx = optionsText.length;

          if (nextRegex) {
            const nMatch = optionsText.substring(startIdx).match(nextRegex);
            if (nMatch) {
              endIdx = startIdx + nMatch.index!;
            }
          }

          options.push(optionsText.substring(startIdx, endIdx).trim());
        }
      }

      const foundOptionCount = options.length;
      if (foundOptionCount < 4) {
        warnings.push(
          `Only ${foundOptionCount} option${foundOptionCount === 1 ? '' : 's'} found — the rest are blank`,
        );
      }
      if (options.some((o) => !o.trim())) {
        warnings.push('One or more options are blank');
      }

      // 3. Extract Answer
      let correctOptionIndex = 0;
      let explanation = '';
      let answerFound = false;

      if (answerMatch) {
        remaining = remaining.substring(answerMatch.index! + answerMatch[0].length).trim();

        // Find which letter it is. e.g. "b) Buy-side Analysts"
        const letterMatch = remaining.match(/([a-d])\)/i);
        if (letterMatch) {
          const letter = letterMatch[1].toLowerCase();
          correctOptionIndex = letter.charCodeAt(0) - 97; // 'a' is 97
          answerFound = true;
        } else {
          warnings.push('"Answer:" found but no option letter after it — defaulted to A');
        }

        // 4. Extract Explanation
        const explanationMatch = remaining.match(/Explanation\s*:/i);
        if (explanationMatch) {
          explanation = remaining.substring(explanationMatch.index! + explanationMatch[0].length).trim();
        } else {
          // If no explicit "Explanation:" tag, the rest is just explanation
          explanation = remaining.replace(/^[a-d]\)[^\n]+/, '').trim();
        }
      } else {
        warnings.push('No "Answer:" line — defaulted to option A. Verify before saving.');
      }

      // An answer letter beyond the options we actually found points at a blank
      // option, which would be unanswerable.
      if (answerFound && correctOptionIndex >= foundOptionCount) {
        warnings.push(
          `Answer points to option ${String.fromCharCode(65 + correctOptionIndex)}, which is blank`,
        );
      }

      if (!explanation.trim()) warnings.push('No explanation');

      // Ensure we have 4 options, pad if necessary
      while (options.length < 4) {
        options.push('');
      }

      questions.push({
        text,
        options,
        correctOptionIndex,
        explanation,
        difficulty: 'standard',
        ...(warnings.length ? { warnings } : {}),
      });
    } catch (e) {
      console.error('Failed to parse a segment', e);
      skipped++;
    }
  }

  return { questions, skipped };
}

/**
 * Validates a pasted JSON question array. The importer previously accepted any
 * array at all, so a payload missing `options` was appended straight into state
 * and crashed the editor on `questions[i].options.map` — with every unsaved
 * question in the bank lost to the reload.
 */
export function validateQuestionPayload(parsed: unknown): {
  ok: boolean;
  questions: ParsedQuestion[];
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(parsed)) {
    return { ok: false, questions: [], errors: ['Top level must be an array of question objects.'] };
  }
  if (parsed.length === 0) {
    return { ok: false, questions: [], errors: ['The array is empty.'] };
  }

  const questions: ParsedQuestion[] = [];

  parsed.forEach((raw: any, i: number) => {
    const label = `Question ${i + 1}`;

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      errors.push(`${label}: not an object.`);
      return;
    }
    if (typeof raw.text !== 'string' || !raw.text.trim()) {
      errors.push(`${label}: missing "text".`);
      return;
    }
    if (!Array.isArray(raw.options) || raw.options.length < 2) {
      errors.push(`${label}: "options" must be an array of at least 2 strings.`);
      return;
    }
    if (raw.options.some((o: unknown) => typeof o !== 'string')) {
      errors.push(`${label}: every option must be a string.`);
      return;
    }

    const idx = Number(raw.correctOptionIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= raw.options.length) {
      errors.push(
        `${label}: "correctOptionIndex" must be a whole number between 0 and ${raw.options.length - 1}.`,
      );
      return;
    }

    const options = [...raw.options];
    while (options.length < 4) options.push('');

    questions.push({
      text: raw.text,
      options,
      correctOptionIndex: idx,
      explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
      difficulty: raw.difficulty === 'hard' ? 'hard' : 'standard',
    });
  });

  return { ok: errors.length === 0, questions, errors };
}
