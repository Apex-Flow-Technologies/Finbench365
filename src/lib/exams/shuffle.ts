/**
 * Deterministic question shuffling.
 *
 * The content spec asks for randomised question order "to reduce answer-sharing
 * between attempts", and the Code Red list flags a fixed order as letting
 * candidates memorise positions rather than learn.
 *
 * The order is derived from the attempt id rather than stored, which matters
 * more than it sounds: a candidate who refreshes mid-exam, or recovers after a
 * disconnect, must see the SAME order they were seeing before. A plain
 * Math.random() shuffle would reorder the paper under them and make their saved
 * answers — which are keyed by question id, but navigated by position — appear
 * to jump around. Same attempt, same seed, same order, on every device.
 */

/** xmur3 string hash, used to turn an attempt id into a 32-bit seed. */
function seedFrom(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 — small, fast, well-distributed PRNG. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a copy of `items` shuffled deterministically for `seedKey`.
 *
 * Fisher-Yates, so every permutation is equally likely — unlike the
 * `sort(() => Math.random() - 0.5)` idiom, which is both biased and unstable.
 */
export function seededShuffle<T>(items: T[], seedKey: string): T[] {
  const out = [...items];
  const next = rng(seedFrom(seedKey));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Orders a paper for one attempt.
 *
 * Returns the original order untouched when randomisation is off for the test,
 * or when there is no attempt id yet (the pre-exam screen, where the candidate
 * is only being shown how many questions there are).
 */
export function orderQuestionsForAttempt<T>(
  questions: T[],
  attemptId: string | null | undefined,
  randomise: boolean | undefined,
): T[] {
  if (!randomise || !attemptId) return questions;

  // Case questions move as one block, never individually.
  //
  // Shuffling every question separately tore the four sub-questions of a case
  // apart and scattered them across the paper — a candidate on question 84
  // would find its siblings at 83, 91 and 94, and the "Question 1..4" tabs
  // jumped somewhere unrelated in the palette each time one was answered. The
  // shared scenario only makes sense read alongside its own questions.
  //
  // So: shuffle the groups, and keep each case's sub-questions in the order the
  // author wrote them. Standalone questions are groups of one, so they still
  // shuffle freely among the cases.
  const groups: T[][] = [];
  const byCase = new Map<string, T[]>();

  for (const q of questions) {
    // Read rather than required: this also orders plain lists that carry no
    // case information at all, where every item is simply its own group.
    const caseId = (q as { caseId?: string | null } | null)?.caseId;
    if (!caseId) {
      groups.push([q]);
      continue;
    }
    const existing = byCase.get(caseId);
    if (existing) {
      existing.push(q);
    } else {
      const group = [q];
      byCase.set(caseId, group);
      groups.push(group);
    }
  }

  return seededShuffle(groups, attemptId).flat();
}
