import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"
import { lexemeVariants } from "@/lib/corpus/tokenizer/lexemeVariants"
import { classifyAdjectiveType, RELATIVE_ADJECTIVE_SUFFIXES, type RelativeAdjectiveSuffix } from "@/lib/grammar/adjective/relativeSuffixes"
import { MorphemeType } from "@/lib/grammar/common/morpheme"
import { cyrillicToLatin } from "@/lib/orthography/standard"

interface Adjective {
    value: string | null
    stem: string | null
}

type Morpheme = { value: string | null; type: number | null }

function fold(value: string) {
    return foldDiacritics(cyrillicToLatin(value.toLowerCase().trim()))
}

/** Предлагает морфемы для проверки по словарной форме. Используется только в отчёте. */
export function findSuffixCandidates(adjective: Adjective, morphemes: Morpheme[]): RelativeAdjectiveSuffix[] {
    if (classifyAdjectiveType(morphemes) === "relative") return []
    const rootValues = morphemes.flatMap(({ value, type }) => type === MorphemeType.ROOT && value ? [fold(value)] : [])
    const candidates = new Set<RelativeAdjectiveSuffix>()
    for (const { value } of lexemeVariants(adjective.value, adjective.stem)) {
        const lemma = fold(value)
        if (!/^[\p{L}]+[yi]$/u.test(lemma)) continue
        const base = lemma.slice(0, -1)
        const suffix = RELATIVE_ADJECTIVE_SUFFIXES.find((marker) => base.length > marker.length && base.endsWith(marker))
        if (suffix && !rootValues.some((root) => root.endsWith(suffix) && base.endsWith(root))) {
            candidates.add(suffix)
        }
    }
    return [...candidates]
}

/** Позволяет сравнить поисковое написание с основой после свёртки диакритики. */
export function hasAdjectiveStemMismatch(adjective: Adjective): boolean {
    return lexemeVariants(adjective.value, adjective.stem).some(({ value, stem }) => {
        if (!stem) return false
        const lemma = fold(value)
        const base = fold(stem)
        return /^[\p{L}]+[yi]$/u.test(lemma) && base !== lemma && base !== lemma.slice(0, -1)
    })
}
