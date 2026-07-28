import { generateWordForms } from '@/lib/grammar/morphology/engine';
import { EngineWordInput, GeneratedForm, MorphoGrammarFeats } from '@/lib/grammar/morphology';
import { PosType, isValidPos } from '@/lib/grammar/common';
import { MorphoAnalysis, MorphoCandidate, MorphoCandidateSource } from './types';
import { etymCyrToEtymLat } from '@/lib/transliteration';
import { getExpectedCasesForPreposition } from '@/lib/corpus/syntax/government';
import { CASE_WEIGHTS } from '@/lib/corpus/priorities/types';
import { normalizeCaseValue } from './caseNormalize';

// Управление предлога слева — почти жёсткое грамматическое правило (не
// статистическая склонность), поэтому перевешивает частотность с большим
// запасом вместо тонкой подстройки веса.
const GOVERNMENT_BONUS = 1_000_000;

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
    isCollocation?: boolean | null;
    corpusFrequencyPerMln?: number | null;
}

type WordQueryFn = (bases: string[]) => Promise<WordBaseRecord[]>;

export interface AnalyzeContext {
    /** Сырой предыдущий токен в предложении (может быть предлогом) — единственный сигнал контекста Фазы 2. */
    leftNeighbor?: string;
}

const MAX_END_LEN = 4;
const MIN_STEM_LEN = 2;

export class DbAnalyzer {
    constructor(
        private queryWordsByBase: WordQueryFn,
        private validEndings: Set<string>,
        private knownPrepositions: string[] = []
    ) {}

    async analyzeWord(surfaceForm: string, context?: AnalyzeContext): Promise<MorphoAnalysis | null> {
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
            // Полный набор омонимов ранжируется по частотности леммы
            // (Lexeme.corpusFrequencyPerMln) с весом по падежу (CASE_WEIGHTS)
            // и, если слева стоит известный предлог, корректируется его
            // управлением (см. scoreMatch) — вместо произвольного DB-order
            // выбора, который был в Фазе 1. Флавор/синсеты — следующие фазы.
            const scored = exactMatches
                .map((m) => ({ ...m, ...this.scoreMatch(m.word, m.form.feats, context?.leftNeighbor) }))
                .sort((a, b) => b.score - a.score);

            const winner = scored[0];
            const result = this.toAnalysis(winner.word, winner.form);
            result.matchCount = scored.length;
            result.candidates = scored.map((m) => this.toCandidate(m.word, m.form, m.score, m.source));
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
            candidates: [this.toCandidate(words[0], { surfaceForm: words[0].isv ?? clean, feats: {} }, 0, 'form_freq')],
        };
    }

    /**
     * Score = частотность леммы * вес падежа, скорректированная управлением
     * предлога слева. Управление — почти жёсткое правило, поэтому при его
     * срабатывании перевешивает частотность (см. GOVERNMENT_BONUS), а не
     * тонко подмешивается к ней.
     */
    private scoreMatch(
        word: WordBaseRecord,
        feats: MorphoGrammarFeats,
        leftNeighbor?: string,
    ): { score: number; source: MorphoCandidateSource } {
        const caseValue = normalizeCaseValue(feats.case);
        const freq = word.corpusFrequencyPerMln ?? 0;
        const caseWeight = caseValue ? (CASE_WEIGHTS[caseValue] ?? 0.1) : 1;
        let score = freq * caseWeight;
        let source: MorphoCandidateSource = 'form_freq';

        if (leftNeighbor && caseValue) {
            const expectedCases = getExpectedCasesForPreposition(leftNeighbor);
            if (expectedCases.length > 0) {
                score += expectedCases.includes(caseValue) ? GOVERNMENT_BONUS : -GOVERNMENT_BONUS;
                source = 'context_gov';
            }
        }

        return { score, source };
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
                isCollocation: word.isCollocation ?? false,
                knownPrepositions: this.knownPrepositions,
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
        const resolvedPos = isValidPos(posTag) ? posTag : PosType.X;
        return {
            lemma: best.word.slug,
            pos: resolvedPos,
            wordSlug: best.word.slug,
            feats: {},
            matchCount: 1,
            isPartialMatch: true,
            flavor: best.word.flavor,
            candidates: [{
                wordSlug: best.word.slug,
                lemma: best.word.slug,
                pos: resolvedPos,
                feats: {},
                flavor: best.word.flavor,
                score: 0,
                source: 'form_freq',
            }],
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

    private toCandidate(
        word: WordBaseRecord,
        form: GeneratedForm,
        score: number = 0,
        source: MorphoCandidateSource = 'form_freq',
    ): MorphoCandidate {
        const pos = (word.pos?.toUpperCase() as PosType) || PosType.X;
        return {
            wordSlug: word.slug,
            lemma: word.slug,
            pos: isValidPos(pos) ? pos : PosType.X,
            feats: form.feats,
            flavor: word.flavor,
            score,
            source,
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