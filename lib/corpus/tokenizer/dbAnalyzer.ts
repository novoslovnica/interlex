import { generateWordForms } from '@/lib/grammar/morphology/engine';
import { EngineWordInput, GeneratedForm } from '@/lib/grammar/morphology';
import { PosType, isValidPos } from '@/lib/grammar/common';
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
    animacy: string | null;
    alternationType: string | null;
    fleetingVowelAt: number | null;
    flavor?: string;
}

type WordQueryFn = (bases: string[]) => Promise<WordBaseRecord[]>;

const MAX_END_LEN = 4;
const MIN_STEM_LEN = 2;

export class DbAnalyzer {
    constructor(
        private queryWordsByBase: WordQueryFn,
        private validEndings: Set<string>
    ) {}

    async analyzeWord(surfaceForm: string): Promise<MorphoAnalysis | null> {
        let clean = surfaceForm.toLowerCase().trim();
        if (!clean) return null;

        if (/[а-яѢѣѦѧѪѫ]/i.test(clean)) {
            clean = etymCyrToEtymLat(clean);
        }

        const candidateBases = this.generateHypotheticalBases(clean);
        if (candidateBases.length === 0) return null;

        const words = await this.queryWordsByBase(candidateBases);
        if (words.length === 0) return null;

        const exactMatches = this.matchForms(clean, words);

        if (exactMatches.length > 0) {
            const result = this.toAnalysis(exactMatches[0].word, exactMatches[0].form);
            result.matchCount = exactMatches.length;
            return result;
        }

        const stemMatch = this.matchByStemPrefix(clean, words);
        if (stemMatch) {
            return stemMatch;
        }

        return {
            lemma: words[0].slug,
            pos: PosType.X,
            wordSlug: words[0].slug,
            feats: {},
            matchCount: 0,
            isPartialMatch: true,
            flavor: words[0].flavor,
        };
    }

    private generateHypotheticalBases(clean: string): string[] {
        const bases = new Set<string>();
        for (let endLen = 0; endLen <= MAX_END_LEN; endLen++) {
            const stemLen = clean.length - endLen;
            if (stemLen < 1) continue;
            if (stemLen < MIN_STEM_LEN && endLen > 0) continue;

            const ending = clean.slice(stemLen);
            if (endLen === 0 || this.validEndings.has(ending)) {
                bases.add(clean.slice(0, stemLen));
            }
        }
        return Array.from(bases);
    }

    private normalizeForm(form: string): string {
        return form
            .replace(/[\u044A\u044C]/g, '')
            .replace(/[čČ]/g, 'c')
            .replace(/[šŠ]/g, 's')
            .replace(/[žŽ]/g, 'z')
            .replace(/[ěĚ]/g, 'e')
            .replace(/[ńŃ]/g, 'n')
            .replace(/[łŁ]/g, 'l')
            .replace(/[óÓ]/g, 'o')
            .replace(/[áÁ]/g, 'a')
            .replace(/[éÉ]/g, 'e')
            .replace(/[íÍ]/g, 'i')
            .replace(/[úÚ]/g, 'u')
            .replace(/[ýÝ]/g, 'y');
    }

    private matchForms(
        clean: string,
        words: WordBaseRecord[]
    ): Array<{ word: WordBaseRecord; form: GeneratedForm }> {
        const normalizedClean = this.normalizeForm(clean);
        const matches: Array<{ word: WordBaseRecord; form: GeneratedForm }> = [];
        for (const word of words) {
            if (!word.isv || !word.pos) continue;
            const posTag = word.pos.toUpperCase();
            if (!isValidPos(posTag)) continue;

            let matched = false;

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
                animacy: word.animacy,
                alternationType: word.alternationType,
                fleetingVowelAt: word.fleetingVowelAt,
                flavor: word.flavor || 'CORE',
            };

            const forms = generateWordForms(engineInput, true);
            for (const form of forms) {
                if (this.normalizeForm(form.surfaceForm.toLowerCase()) === normalizedClean) {
                    matches.push({ word, form });
                    matched = true;
                }
            }

            if (!matched && this.normalizeForm(word.isv.toLowerCase()) === normalizedClean) {
                matches.push({
                    word,
                    form: { surfaceForm: word.isv, feats: {} },
                });
            }
        }
        return matches;
    }

    private matchByStemPrefix(
        clean: string,
        words: WordBaseRecord[]
    ): MorphoAnalysis | null {
        let best: { word: WordBaseRecord; stemLen: number } | null = null;

        for (const word of words) {
            if (!word.isv || !word.pos) continue;
            const stem = (word.stem || word.base || '').toLowerCase();
            if (!stem) continue;
            if (!clean.startsWith(stem)) continue;

            if (!best) {
                best = { word, stemLen: stem.length };
                continue;
            }

            const isExact = stem.length === clean.length;
            const bestIsExact = best.stemLen === clean.length;

            if (isExact && !bestIsExact) continue;
            if (!isExact && bestIsExact) { best = { word, stemLen: stem.length }; continue; }

            if (stem.length > best.stemLen) {
                best = { word, stemLen: stem.length };
            }
        }

        if (!best) return null;

        const bestPos = best.word.pos!;
        const posTag = bestPos.toUpperCase();
        return {
            lemma: best.word.slug,
            pos: isValidPos(posTag) ? posTag : PosType.X,
            wordSlug: best.word.slug,
            feats: {},
            matchCount: 1,
            isPartialMatch: true,
            flavor: best.word.flavor,
        };
    }

    private toAnalysis(word: WordBaseRecord, form: GeneratedForm): MorphoAnalysis {
        const pos = (word.pos?.toUpperCase() as PosType) || PosType.X;
        return {
            lemma: word.slug,
            pos: isValidPos(pos) ? pos : PosType.X,
            wordSlug: word.slug,
            feats: form.feats,
            flavor: word.flavor,
        };
    }
}

export async function analyzeWithDb(
    surfaceForm: string,
    queryWordsByBase: WordQueryFn,
    validEndings: Set<string>
): Promise<MorphoAnalysis | null> {
    const analyzer = new DbAnalyzer(queryWordsByBase, validEndings);
    return analyzer.analyzeWord(surfaceForm);
}