export interface ParsedQuestion {
  text: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  difficulty: 'standard' | 'hard';
}

export function parseDocxText(rawText: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  
  // Split by "Question X" or "Question X.Y"
  const rawSegments = rawText.split(/Question\s+\d+(?:\.\d+)?/i);
  
  // The first segment is usually preamble (before the first question), so we skip it if it doesn't contain options.
  for (let i = 1; i < rawSegments.length; i++) {
    const segment = rawSegments[i].trim();
    if (!segment) continue;

    try {
      // 1. Extract Question Text (Everything before "a)")
      // We look for the first occurrence of "a)" at the start of a line or anywhere.
      const matchA = segment.match(/a\)\s+/i);
      if (!matchA) continue; // Not a valid question if it doesn't have options

      const text = segment.substring(0, matchA.index).trim();
      let remaining = segment.substring(matchA.index!);

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

      // 3. Extract Answer
      let correctOptionIndex = 0;
      let explanation = "";
      
      if (answerMatch) {
        remaining = remaining.substring(answerMatch.index! + answerMatch[0].length).trim();
        
        // Find which letter it is. e.g. "b) Buy-side Analysts"
        const letterMatch = remaining.match(/([a-d])\)/i);
        if (letterMatch) {
          const letter = letterMatch[1].toLowerCase();
          correctOptionIndex = letter.charCodeAt(0) - 97; // 'a' is 97
        }
        
        // 4. Extract Explanation
        const explanationMatch = remaining.match(/Explanation\s*:/i);
        if (explanationMatch) {
          explanation = remaining.substring(explanationMatch.index! + explanationMatch[0].length).trim();
        } else {
          // If no explicit "Explanation:" tag, the rest is just explanation
          explanation = remaining.replace(/^[a-d]\)[^\n]+/, '').trim();
        }
      }

      // Ensure we have 4 options, pad if necessary
      while (options.length < 4) {
        options.push("");
      }

      questions.push({
        text,
        options,
        correctOptionIndex,
        explanation,
        difficulty: 'standard'
      });
    } catch (e) {
      console.error("Failed to parse a segment", e);
    }
  }

  return questions;
}
