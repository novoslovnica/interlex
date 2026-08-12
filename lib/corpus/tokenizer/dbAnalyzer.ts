import { generateWordForms } from '@/lib/grammar/morphology/engine';
import { EngineWordInput, GeneratedForm, MorphoGrammarFeats } from '@/lib/grammar/morphology';
import { PosType, isValidPos } from '@/lib/grammar/common';
import { MorphoAnalysis, MorphoCandidate, MorphoCandidateSource } from './types';
import { etymCyrToEtymLat } from '@/lib/transliteration';
import { getExpectedCasesForPreposition } from '@/lib/corpus/syntax/government';
import { CASE_WEIGHTS } from '@/lib/corpus/priorities/types';
import { normalizeCaseValue } from './caseNormalize';
import { expandSpellingVariants } from './spellingVariants';

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

// Одна суппletивная/нерегулярная форма конкретной лексемы из
// InflectionAnomaly ("jest"/"sųt" у "byti" — не раскладывается на стем+
// окончание вообще, это другой корень). grammeme — сырой, слабо
// структурированный тег из этой таблицы ("PRES"/"L_PART"/"FUT"/"PL_GEN"/...),
// не полноценная UD-граммема — сюда не мапится в MorphoGrammarFeats,
// поэтому feats у таких совпадений всегда {} (см. analyzeWord).
export interface AnomalyMatch {
    wordSlug: string;
    lemma: string;
    pos: PosType;
    grammeme: string;
    corpusFrequencyPerMln: number | null;
}

// Ключ — нормализованная (lowercase + этим. кир.→лат., см.
// normalizeSurfaceForm в lib/corpus/candidates/reconstruct.ts) форма
// InflectionAnomaly.inflection.
export type InflectionAnomalyIndex = Map<string, AnomalyMatch[]>;

const MAX_END_LEN = 4;
const MIN_STEM_LEN = 2;

export class DbAnalyzer {
    constructor(
        private queryWordsByBase: WordQueryFn,
        private validEndings: Set<string>,
        private knownPrepositions: string[] = [],
        private inflectionAnomalies: InflectionAnomalyIndex = new Map()
    ) {}

    async analyzeWord(surfaceForm: string, context?: AnalyzeContext): Promise<MorphoAnalysis | null> {
        let clean = surfaceForm.toLowerCase().trim();
        if (!clean) return null;

        if (/[а-яѢѣѦѧѪѫ]/i.test(clean)) {
            clean = etymCyrToEtymLat(clean);
        }

        // A plain letter (e.g. "u") can be a simplified spelling of a
        // canonical diacritic letter (e.g. "ų") - widen the search to every
        // plausible de-simplified variant so "sut" also finds what "sųt"
        // would (see spellingVariants.ts). Always includes `clean` itself.
        const cleanVariants = expandSpellingVariants(clean);

        const anomalyEntries = this.dedupeAnomalies(
            cleanVariants.flatMap((variant) => this.inflectionAnomalies.get(variant) ?? [])
        );

        const candidateBaseSet = new Set<string>();
        for (const variant of cleanVariants) {
            for (const base of this.generateHypotheticalBases(variant)) {
                candidateBaseSet.add(base);
            }
        }
        const candidateBases = Array.from(candidateBaseSet);
        const words = candidateBases.length > 0 ? await this.queryWordsByBase(candidateBases) : [];

        const exactMatches = words.length > 0 ? this.matchForms(cleanVariants, words) : [];
        // Стем-префиксный фоллбек — как и раньше, только когда точной формы
        // вообще не нашлось (тот же приоритет, что был в старом коде: он
        // никогда не конкурировал с exactMatches, только подменял их
        // отсутствие). Теперь его кандидат тоже участвует в общем пуле
        // омонимов вместе с аномалиями — раньше он "терялся", если для того
        // же слова находилась ещё и аномальная форма (см. случай "sųt":
        // и byti-VERB через аномалию, и sut-AUX через стем-префикс — оба
        // реальные представления одного и того же слова в словаре).
        const stemPrefixWord = exactMatches.length === 0 && words.length > 0
            ? this.findBestStemPrefixWord(cleanVariants, words)
            : null;

        if (exactMatches.length > 0 || anomalyEntries.length > 0 || stemPrefixWord) {
            // Точные совпадения, аномальные (суппletивные) формы и лучший
            // стем-префиксный кандидат объединяются в один пул омонимов и
            // ранжируются одинаково (см. scoreMatch) — аномалия не
            // изобретена регулярной морфологией, но для целей "какая
            // лексема это слово" она так же авторитетна, как точное
            // совпадение парадигмы; стем-префиксный кандидат остаётся
            // самым слабым (isPartial), как и раньше.
            type Candidate = { word: WordBaseRecord; form: GeneratedForm; forcedSource?: MorphoCandidateSource; isPartial?: boolean };
            const combined: Candidate[] = [
                ...exactMatches,
                ...anomalyEntries.map((a): Candidate => ({
                    word: this.anomalyToWordRecord(a),
                    form: { surfaceForm: clean, feats: {} },
                    forcedSource: 'anomaly',
                })),
                ...(stemPrefixWord ? [{ word: stemPrefixWord, form: { surfaceForm: clean, feats: {} }, isPartial: true }] : []),
            ];

            const scored = combined
                .map((m) => {
                    const scoreResult = this.scoreMatch(m.word, m.form.feats, context?.leftNeighbor);
                    return { ...m, ...scoreResult, source: m.forcedSource ?? scoreResult.source };
                })
                .sort((a, b) => b.score - a.score);

            const winner = scored[0];
            const result = this.toAnalysis(winner.word, winner.form);
            result.matchCount = scored.length;
            result.isPartialMatch = !!winner.isPartial;
            result.candidates = scored.map((m) => this.toCandidate(m.word, m.form, m.score, m.source));
            return result;
        }

        if (words.length === 0) return null;

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

    // Merging anomaly lookups across spelling variants (see cleanVariants in
    // analyzeWord) can surface the same anomaly row more than once if it
    // happens to match under several variants - dedupe by (wordSlug,
    // grammeme), same key shape as buildInflectionAnomalyIndex's own
    // defensive dedup in analyzer-factory.ts.
    private dedupeAnomalies(entries: AnomalyMatch[]): AnomalyMatch[] {
        const seen = new Set<string>();
        const result: AnomalyMatch[] = [];
        for (const entry of entries) {
            const key = `${entry.wordSlug}|${entry.grammeme}`;
            if (seen.has(key)) continue;
            seen.add(key);
            result.push(entry);
        }
        return result;
    }

    private anomalyToWordRecord(a: AnomalyMatch): WordBaseRecord {
        return {
            id: -1,
            slug: a.wordSlug,
            isv: a.lemma,
            pos: a.pos,
            protoStemClass: null,
            stemExtension: null,
            paradigm: null,
            stem: null,
            base: null,
            gender: null,
            animacy: null,
            alternationType: null,
            fleetingVowelAt: null,
            flavor: 'CORE',
            isCollocation: false,
            corpusFrequencyPerMln: a.corpusFrequencyPerMln,
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
        cleanVariants: string[],
        words: WordBaseRecord[]
    ): Array<{ word: WordBaseRecord; form: GeneratedForm }> {
        const normalizedVariants = new Set(cleanVariants.map((v) => this.normalizeForm(v)));
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
                if (normalizedVariants.has(this.normalizeForm(form.surfaceForm.toLowerCase()))) {
                    matches.push({ word, form });
                    matched = true;
                }
            }

            if (!matched && normalizedVariants.has(this.normalizeForm(word.isv.toLowerCase()))) {
                matches.push({
                    word,
                    form: { surfaceForm: word.isv, feats: {} },
                });
            }
        }
        return matches;
    }

    /**
     * Лучший кандидат по совпадению стема-префикса (когда движок не
     * сгенерировал точную форму, но известный стем — префикс словоформы).
     * Раньше собирал сразу целый MorphoAnalysis с единственным кандидатом;
     * теперь возвращает только победителя, чтобы analyzeWord() мог смешать
     * его с точными и аномальными кандидатами в один пул омонимов.
     */
    private findBestStemPrefixWord(
        cleanVariants: string[],
        words: WordBaseRecord[]
    ): WordBaseRecord | null {
        // Same tie-break as before, generalized across spelling variants:
        // prefer a stem shorter than the full surface form (i.e. a real
        // word + ending) over a stem that equals the whole surface form (no
        // ending at all - a weaker, more coincidental match), then prefer
        // the longest stem.
        const isBetter = (
            candidate: { stemLen: number; isExact: boolean },
            current: { stemLen: number; isExact: boolean } | null
        ): boolean => {
            if (!current) return true;
            if (candidate.isExact !== current.isExact) return !candidate.isExact;
            return candidate.stemLen > current.stemLen;
        };

        let best: { word: WordBaseRecord; stemLen: number; isExact: boolean } | null = null;

        for (const word of words) {
            if (!word.isv || !word.pos) continue;
            const stem = (word.stem || word.base || '').toLowerCase();
            if (!stem) continue;

            // A word may match under more than one spelling variant - keep
            // this word's own strongest match first.
            let wordBest: { stemLen: number; isExact: boolean } | null = null;
            for (const variant of cleanVariants) {
                if (!variant.startsWith(stem)) continue;
                const candidate = { stemLen: stem.length, isExact: stem.length === variant.length };
                if (isBetter(candidate, wordBest)) wordBest = candidate;
            }
            if (!wordBest) continue;

            if (isBetter(wordBest, best)) {
                best = { word, ...wordBest };
            }
        }

        return best?.word ?? null;
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