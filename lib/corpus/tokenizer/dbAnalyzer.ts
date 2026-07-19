import { generateWordForms } from '@/lib/grammar/morphology/engine';
import { EngineWordInput, GeneratedForm } from '@/lib/grammar/morphology';
import { PosType, isValidPos, MorphoGrammarFeats } from '@/lib/grammar/common';
import { MorphoAnalysis } from './types';
import { etymCyrToEtymLat } from '@/lib/transliteration';

export interface WordBaseRecord {
    id: number;
    slug: string;
    isv: string | null;
    pos: string | null;
    protoStemClass: string | null;
    stemExtension: string | null;
    paradigm: string | null;
    stem: string | null;
    base: string | null;
    gender: string | null;
    alternationType: string | null;
    fleetingVowelAt: number | null;
}

type WordQueryFn = (bases: string[]) => Promise<WordBaseRecord[]>;

const MIN_STEM_LEN = 2;

export class DbAnalyzer {
    constructor(private queryWordsByBase: WordQueryFn) {}

    async analyzeWord(surfaceForm: string): Promise<MorphoAnalysis | null> {
        let clean = surfaceForm.toLowerCase().trim();
        if (!clean) return null;

        if (/[а-яѢѣѦѧѪѫ]/i.test(clean)) {
            clean = etymCyrToEtymLat(clean);
        }

        const hypotheticalBases = this.generateHypotheticalBases(clean);
        const words = await this.queryWordsByBase(hypotheticalBases);
        if (words.length === 0) return null;

        const bestWords = this.filterLongestStem(words);
        if (bestWords.length === 0) return null;

        const matches = this.matchForms(clean, bestWords);

        if (matches.length === 1) {
            const result = this.toAnalysis(matches[0].word, matches[0].form);
            result.matchCount = 1;
            return result;
        }

        if (matches.length > 1) {
            const result = this.toAnalysis(matches[0].word, matches[0].form);
            result.matchCount = matches.length;
            return result;
        }

        return {
            lemma: bestWords[0].slug,
            pos: PosType.X,
            wordSlug: bestWords[0].slug,
            feats: {},
            matchCount: 0,
            isPartialMatch: true,
        };
    }

    private generateHypotheticalBases(clean: string): string[] {
        const bases = new Set<string>();
        for (let len = clean.length; len >= MIN_STEM_LEN; len--) {
            bases.add(clean.slice(0, len));
        }
        return Array.from(bases);
    }

    private filterLongestStem(words: WordBaseRecord[]): WordBaseRecord[] {
        const stems = words.map(w => w.stem).filter(Boolean) as string[];
        if (stems.length === 0) return [];
        const longestLen = Math.max(...stems.map(s => s.length));
        return words.filter(w => w.stem && w.stem.length === longestLen);
    }

    private normalizeForm(form: string): string {
        return form.replace(/[\u044A\u044C]/g, '');
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

            const forms = generateWordForms(engineInput, true);
            for (const form of forms) {
                if (this.normalizeForm(form.surfaceForm.toLowerCase()) === clean) {
                    matches.push({ word, form });
                }
            }
        }
        return matches;
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