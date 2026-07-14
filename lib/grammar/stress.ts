const VOWEL_RE = /[aeiouyěęǫọų]/gi;

export function countSyllables(word: string): number {
  const matches = word.match(VOWEL_RE);
  return matches ? matches.length : 0;
}

function syllableIndexOfChar(word: string, charIndex: number): number {
  const prefix = word.slice(0, charIndex);
  const matches = prefix.match(VOWEL_RE);
  return matches ? matches.length : 0;
}

export interface MorphemeStressInput {
  value: string;
  stressPosition?: number | null;
}

export function computeStressFromMorphemes(
  fullForm: string,
  morphemes: MorphemeStressInput[],
): number | null {
  const dominant: { startChar: number; stressInMorpheme: number }[] = [];

  for (const m of morphemes) {
    if (m.stressPosition == null) continue;
    const idx = fullForm.indexOf(m.value);
    if (idx === -1) continue;
    dominant.push({ startChar: idx, stressInMorpheme: m.stressPosition });
  }

  if (dominant.length === 0) return null;

  const rightmost = dominant.reduce((a, b) => (a.startChar > b.startChar ? a : b));

  const syllableBefore = syllableIndexOfChar(fullForm, rightmost.startChar);
  return syllableBefore + rightmost.stressInMorpheme;
}