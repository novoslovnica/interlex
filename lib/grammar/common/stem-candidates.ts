/**
 * Generates all probable stem variants for a word to enable tokenization lookup.
 *
 * Given a primary stem and optional secondary/tertiary stems, produces:
 * - The raw stems themselves
 * - Stems with fleeting vowels removed (e, ě, ь, ъ in penultimate position)
 * - Stems with first palatalization applied (k→č, g→ž, h→š, ch→š)
 * - Stems with iotation applied (sk→šč, sl→šlj, etc.)
 * - Stems extended with `stemExtension` (e.g. consonant-stem nouns like `imę` → `imen`)
 *
 * All variants are collected in a Set to eliminate duplicates before returning.
 */
import { applyFirstPalatalization, applyIotation } from '../morphonology';
import { PosType } from './pos';

const FLEETING_VOWELS = new Set(['e', 'ь', 'ъ']);
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y', 'ě', 'ę', 'ǫ', 'ų', 'å', 'ȯ']);

function isConsonant(ch: string): boolean {
  return ch.length === 1 && !VOWELS.has(ch) && /[a-zčšžćđńljǯ]/i.test(ch);
}

/** Removes a fleeting vowel (e, ь, ъ) from the penultimate position of a stem if followed by a consonant. */
export function removeFleetingVowel(stem: string): string | null {
  if (stem.length < 2) return null;
  const last = stem[stem.length - 1];
  const secondLast = stem[stem.length - 2];
  if (isConsonant(last) && FLEETING_VOWELS.has(secondLast)) {
    return stem.slice(0, -2) + last;
  }
  return null;
}

/** Input parameters for stem candidate generation. */
export interface StemCandidateInput {
  stem: string | null;
  secondaryStem?: string | null;
  tertiaryStem?: string | null;
  stemExtension?: string | null;
  isv?: string | null;
  pos?: string | null;
}

/**
 * Generate all stem variants for a word for tokenization lookup.
 *
 * For each primary stem (primary, secondaryStem, tertiaryStem), produces:
 * 1. The raw stem
 * 2. Fleeting vowel removed variant
 * 3. First palatalization variant  (k→č, g→ž, h→š)
 * 4. Iotation variant (sk→šč, sl→šlj, etc.)
 * 5. Fleeting-vowel-removed + first palatalization variant
 *
 * Additionally handles:
 * - `stemExtension`: appends extension to primary stem (for consonant-stem nouns)
 * - Nouns ending in `ę`: generates an `en`-extended stem (e.g. `imę` → `imen`)
 */
export function generateStemCandidates(params: StemCandidateInput): string[] {
  const { stem, secondaryStem, tertiaryStem, stemExtension, isv, pos } = params;
  const candidates = new Set<string>();

  const primaryStems = [
    stem,
    secondaryStem || null,
    tertiaryStem || null,
  ].filter((s): s is string => s !== null && s.length > 0);

  for (const s of primaryStems) {
    candidates.add(s);

    const withoutFleeting = removeFleetingVowel(s);
    if (withoutFleeting) candidates.add(withoutFleeting);

    const palatalized = applyFirstPalatalization(s);
    if (palatalized !== s) candidates.add(palatalized);

    const iotated = applyIotation(s);
    if (iotated !== s && iotated !== palatalized) candidates.add(iotated);

    if (withoutFleeting) {
      const palatalizedFleeting = applyFirstPalatalization(withoutFleeting);
      if (palatalizedFleeting !== withoutFleeting) candidates.add(palatalizedFleeting);
    }
  }

  if (stem && stemExtension) {
    candidates.add(stem + stemExtension.toLowerCase());
  } else if (stem && isv && pos?.toUpperCase() === PosType.NOUN) {
    if (isv.endsWith('ę')) {
      const enStem = stem.endsWith('en') ? stem : stem + 'en';
      candidates.add(enStem);
    }
  }

  return [...candidates];
}