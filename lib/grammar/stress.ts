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

/**
 * Единая точка переопределения ударения: морфема (ударный суффикс, многосложный
 * корень) побеждает, иначе — ударение слова целиком (для поздних заимствований),
 * иначе — null (используется дефолтное праслав. правило парадигмы). Возвращает
 * индекс слога С КОНЦА слова — в этом представлении работают все движки
 * (fourTonesGenerator.ts, noun/index.ts, verb/index.ts и т.д.).
 */
export function resolveStressOverride(
  fullForm: string,
  morphemes?: MorphemeStressInput[] | null,
  lexemeStressPosition?: number | null,
): number | null {
  const fromMorphemes = morphemes ? computeStressFromMorphemes(fullForm, morphemes) : null;
  const stressFromStart = fromMorphemes ?? lexemeStressPosition ?? null;
  if (stressFromStart == null) return null;
  const totalSyllables = countSyllables(fullForm);
  if (totalSyllables === 0) return null;
  // stressPosition/морфемное ударение считаются относительно словарной (цитатной)
  // формы, но переиспользуются для всех производных форм слова (аорист, императив,
  // причастия и т.д.), у которых число слогов может отличаться — зажимаем в
  // валидный диапазон, чтобы не выйти за границы слова вместо падения с ошибкой.
  return Math.max(0, Math.min(totalSyllables - 1, totalSyllables - 1 - stressFromStart));
}