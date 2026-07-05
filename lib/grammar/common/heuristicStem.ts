import { PosType } from './pos';

const REFLEXIVE_SUFFIX = ' sę';
const VERB_ENDINGS = ['či', 'ti'];
const NOUN_ENDINGS = ['jev', 'ij', 'ja', 'je', 'ę', 'o', 'a', 'e', 'ь'];
const ADJ_ENDINGS = ['oj', 'ej', 'y', 'i'];
const ADV_ENDINGS = ['o', 'e'];

function removeSuffix(word: string, suffixes: string[]): string | null {
  for (const suffix of suffixes) {
    if (word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return null;
}

function extractVerbStem(word: string): string {
  const base = word.endsWith(REFLEXIVE_SUFFIX)
    ? word.slice(0, -REFLEXIVE_SUFFIX.length).trimEnd()
    : word;

  const withoutEnding = removeSuffix(base, VERB_ENDINGS);
  if (withoutEnding !== null) {
    if (base.endsWith('či')) {
      return withoutEnding.slice(0, -1) + 'k';
    }
    return withoutEnding;
  }

  return word;
}

function extractNounStem(word: string): string {
  if (word.endsWith('ę')) {
    return word.slice(0, -1) + 'en';
  }

  const withoutEnding = removeSuffix(word, NOUN_ENDINGS);
  if (withoutEnding !== null) {
    return withoutEnding;
  }

  return word;
}

function extractAdjectiveStem(word: string): string {
  const withoutEnding = removeSuffix(word, ADJ_ENDINGS);
  if (withoutEnding !== null) {
    return withoutEnding;
  }
  return word;
}

function extractAdverbStem(word: string): string {
  const withoutEnding = removeSuffix(word, ADV_ENDINGS);
  if (withoutEnding !== null) {
    return withoutEnding;
  }
  return word;
}

export function heuristicStem(word: string, pos?: string | null): string {
  if (!word) return '';

  const cleanWord = word.trim();

  switch (pos?.toUpperCase()) {
    case PosType.VERB:
    case 'VERB':
      return extractVerbStem(cleanWord);
    case PosType.NOUN:
    case 'NOUN':
    case PosType.PROPN:
    case 'PROPN':
      return extractNounStem(cleanWord);
    case PosType.ADJ:
    case 'ADJ':
      return extractAdjectiveStem(cleanWord);
    case PosType.ADV:
    case 'ADV':
      return extractAdverbStem(cleanWord);
    default:
      return cleanWord;
  }
}