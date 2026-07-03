import { PosType, MorphoGrammarFeats, GrammaticalCase, GrammaticalGender } from '@/lib/grammar/common';
import { MorphoAnalysis } from './types';

const CYRILLIC_PATTERN = /[а-яёѕєіјљњћџѫѭѣ]/i;

const POS_HEURISTICS: Array<{
    test: (word: string) => boolean;
    pos: PosType;
    getLemma: (word: string) => string;
    getFeats: (word: string) => MorphoGrammarFeats;
}> = [
    {
        test: (w) => w.endsWith('om') || w.endsWith('em'),
        pos: PosType.NOUN,
        getLemma: (w) => w.slice(0, -2) || w,
        getFeats: () => ({ case: GrammaticalCase.INS, number: 'sg' }),
    },
    {
        test: (w) => w.endsWith('la') && w.length > 3,
        pos: PosType.VERB,
        getLemma: (w) => w.slice(0, -1) || w,
        getFeats: () => ({ tense: 'past', gender: GrammaticalGender.FEM, number: 'sg', verbForm: 'part' }),
    },
    {
        test: (w) => w.endsWith('m') && !w.endsWith('om') && !w.endsWith('em') && w.length > 2,
        pos: PosType.VERB,
        getLemma: (w) => w.slice(0, -1) || w,
        getFeats: () => ({ person: '1', number: 'sg', tense: 'pres', verbForm: 'fin' }),
    },
    {
        test: (w) => w.endsWith('a') && w.length > 1,
        pos: PosType.NOUN,
        getLemma: (w) => w.slice(0, -1) || w,
        getFeats: () => ({ gender: GrammaticalGender.FEM, number: 'sg' }),
    },
    {
        test: (w) => w.endsWith('u') && w.length > 2,
        pos: PosType.NOUN,
        getLemma: (w) => w.slice(0, -1) || w,
        getFeats: () => ({ case: GrammaticalCase.DAT, number: 'sg' }),
    },
    {
        test: (w) => w.endsWith('y') || w.endsWith('i'),
        pos: PosType.ADJ,
        getLemma: (w) => w,
        getFeats: () => ({ gender: GrammaticalGender.MASC, number: 'sg' }),
    },
    {
        test: (w) => w.endsWith('o') || w.endsWith('e'),
        pos: PosType.ADV,
        getLemma: (w) => w,
        getFeats: () => ({ degree: 'pos' }),
    },
];

function isCyrillic(word: string): boolean {
    return CYRILLIC_PATTERN.test(word);
}

function normalizeWord(word: string): string {
    return word.toLowerCase().replace(/[^a-zа-яёѕєіјљњћџѫѭѣžčšě]/gi, '');
}

function applyHeuristics(clean: string): MorphoAnalysis | null {
    for (const h of POS_HEURISTICS) {
        if (h.test(clean)) {
            const lemma = h.getLemma(clean);
            const pos = h.pos;
            return {
                lemma,
                pos,
                wordSlug: `${lemma}-${pos.toLowerCase()}`,
                feats: h.getFeats(clean),
            };
        }
    }
    return null;
}

export function analyzeWord(word: string): MorphoAnalysis {
    const clean = normalizeWord(word);
    if (!clean) {
        return { lemma: word, pos: PosType.X, wordSlug: null, feats: {} };
    }

    const heuristic = applyHeuristics(clean);
    if (heuristic) {
        return heuristic;
    }

    return {
        lemma: clean,
        pos: PosType.X,
        wordSlug: `${clean}-x`,
        feats: {},
    };
}