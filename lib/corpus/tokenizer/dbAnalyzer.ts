import { generateWordForms } from '@/lib/grammar/morphology/engine';
import { EngineWordInput, GeneratedForm } from '@/lib/grammar/morphology';
import { PosType, isValidPos, MorphoGrammarFeats } from '@/lib/grammar/common';
import { MorphoAnalysis } from './types';
import { analyzeWord as heuristicAnalyze } from './morphology';

interface WordBaseRecord {
    id: number;
    slug: string;
    isv: string | null;
    pos: string | null;
    protoStemClass: string | null;
    stemExtension: string | null;
    paradigm: string | null;
    base: string | null;
    gender: string | null;
    alternationType: string | null;
    fleetingVowelAt: number | null;
}

type WordQueryFn = (bases: string[]) => Promise<WordBaseRecord[]>;

const BASE_EXTRACTION_RULES: Array<{ suffix: string; minLen: number }> = [
    { suffix: 'ogo', minLen: 4 },
    { suffix: 'omu', minLen: 4 },
    { suffix: 'ymi', minLen: 4 },
    { suffix: 'imi', minLen: 4 },
    { suffix: 'yla', minLen: 5 },
    { suffix: 'ila', minLen: 5 },
    { suffix: 'ala', minLen: 5 },
    { suffix: 'yla', minLen: 5 },
    { suffix: 'la',  minLen: 4 },
    { suffix: 'om',  minLen: 4 },
    { suffix: 'em',  minLen: 4 },
    { suffix: 'm',   minLen: 4 },
    { suffix: 'a',   minLen: 3 },
    { suffix: 'u',   minLen: 4 },
    { suffix: 'y',   minLen: 3 },
    { suffix: 'i',   minLen: 3 },
    { suffix: 'o',   minLen: 3 },
    { suffix: 'e',   minLen: 3 },
];

export class DbAnalyzer {
    constructor(private queryWordsByBase: WordQueryFn) {}

    async analyzeWord(surfaceForm: string): Promise<MorphoAnalysis | null> {
        const clean = surfaceForm.toLowerCase().trim();
        if (!clean) return null;

        const baseCandidates = this.extractBaseCandidates(clean);
        const words = await this.queryWordsByBase(baseCandidates);
        if (words.length === 0) return null;

        const matches = this.matchForms(clean, words);
        if (matches.length === 0) return null;

        return this.pickBest(clean, matches);
    }

    private extractBaseCandidates(surfaceForm: string): string[] {
        const candidates = new Set<string>();
        candidates.add(surfaceForm);
        for (const { suffix, minLen } of BASE_EXTRACTION_RULES) {
            if (surfaceForm.endsWith(suffix) && surfaceForm.length > minLen) {
                candidates.add(surfaceForm.slice(0, -suffix.length));
            }
        }
        return Array.from(candidates);
    }

    private matchForms(
        clean: string,
        words: WordBaseRecord[]
    ): Array<{ word: WordBaseRecord; form: GeneratedForm }> {
        const matches: Array<{ word: WordBaseRecord; form: GeneratedForm }> = [];
        for (const word of words) {
            if (!word.isv || !word.pos) continue;
            const posTag = word.pos.toUpperCase();
            if (!isValidPos(posTag)) continue;

            const engineInput: EngineWordInput = {
                id: word.id,
                slug: word.slug,
                isv: word.isv,
                pos: posTag,
                protoStemClass: word.protoStemClass,
                stemExtension: word.stemExtension,
                paradigm: word.paradigm,
                stem: word.stem,
                gender: word.gender,
                alternationType: word.alternationType,
                fleetingVowelAt: word.fleetingVowelAt,
            };

            const forms = generateWordForms(engineInput);
            for (const form of forms) {
                if (form.surfaceForm.toLowerCase() === clean) {
                    matches.push({ word, form });
                }
            }
        }
        return matches;
    }

    private pickBest(
        _clean: string,
        matches: Array<{ word: WordBaseRecord; form: GeneratedForm }>
    ): MorphoAnalysis {
        if (matches.length === 1) {
            return this.toAnalysis(matches[0].word, matches[0].form);
        }

        const known = knownForms.get(_clean);
        if (known) {
            const match = matches.find(m => m.word.slug === known.slug);
            if (match) return this.toAnalysis(match.word, match.form);
        }

        return this.toAnalysis(matches[0].word, matches[0].form);
    }

    private toAnalysis(word: WordBaseRecord, form: GeneratedForm): MorphoAnalysis {
        const pos = (word.pos?.toUpperCase() as PosType) || PosType.X;
        return {
            lemma: word.slug,
            pos: isValidPos(pos) ? pos : PosType.X,
            wordSlug: word.slug,
            feats: form.feats,
        };
    }
}

export function createBaseQuery(prismaData: {
    word: {
        findMany: (args: {
            where: { base: { in: string[]; not: null } };
            select: Record<string, boolean>;
        }) => Promise<WordBaseRecord[]>;
    };
}): WordQueryFn {
    return (bases: string[]) =>
        prismaData.word.findMany({
            where: { base: { in: bases, not: null } },
            select: {
                id: true,
                slug: true,
                isv: true,
                pos: true,
                protoStemClass: true,
                stemExtension: true,
                paradigm: true,
                stem: true,
                gender: true,
                alternationType: true,
                fleetingVowelAt: true,
                base: true,
            },
        });
}

export async function analyzeWithDb(
    surfaceForm: string,
    queryWordsByBase: WordQueryFn
): Promise<MorphoAnalysis | null> {
    const analyzer = new DbAnalyzer(queryWordsByBase);
    return analyzer.analyzeWord(surfaceForm);
}

const knownForms = new Map<string, { slug: string }>();