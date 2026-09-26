// Парадигма лексемы как данные, без React: одна функция на часть речи, из тех
// же вызовов движка, что строят таблицы на странице слова. Страница слова и
// боты (lib/bots) берут парадигму отсюда - иначе у них разошлись бы формы, как
// уже было с двумя путями склонения существительных
// (docs/history/2026-07-25-noun-declension-consolidation.md). Модуль чистый: без БД и next/*,
// поэтому годится и для серверных, и для клиентских компонентов.

import { declineWordAutomatically, asNStemIfMisfiled } from "@/lib/grammar/declineNoun"
import { resolveGender } from "@/lib/grammar/stemClassifier"
import { buildVerbModel, conjugateFullVerb, type ConjugationResult } from "@/lib/grammar/verb"
import { splitMechanicalVerbTail, appendTailToConjugation } from "@/lib/grammar/verb/mechanicalTail"
import { generateAdjectiveForm, type EnhancedAdjDbItem } from "@/lib/grammar/adjective/index"
import { Case, NumberType } from "@/lib/grammar/endingsRegistry"
import { GrammaticalGender } from "@/lib/grammar/common/gender"
import { AccentParadigm } from "@/lib/grammar/common/paradigm"
import { ProtoStemClass } from "@/lib/grammar/common/stem"
import { PosType, VerbalAspect } from "@/lib/grammar/common"

/** Поля лексемы, от которых зависит парадигма (строка lexemes + корни). */
export interface ParadigmSource {
    pos?: string | null
    value: string
    stem?: string | null
    secondaryStem?: string | null
    tertiaryStem?: string | null
    aspect?: string | null
    paradigm?: string | null
    gender?: string | null
    animacy?: string | null
    protoStemClass?: string | null
    stemExtension?: string | null
    stressPosition?: number | null
    isCollocation?: boolean | number | null
    proto?: string | null
    /** CORE-написание лексемы, если есть (getItem: item.word?.value). */
    coreValue?: string | null
    roots?: { value: string; stressPosition?: number | null }[]
}

export const NOUN_CASES = ["nom", "gen", "dat", "acc", "ins", "loc", "voc"] as const
export const NOUN_NUMBERS = ["singular", "dual", "plural"] as const
export type NounCase = typeof NOUN_CASES[number]
export type NounParadigm = Record<typeof NOUN_NUMBERS[number], Record<string, string>>

export function buildNounParadigm(src: ParadigmSource): NounParadigm | null {
    if (src.pos !== PosType.NOUN || src.isCollocation) return null
    const result: NounParadigm = { singular: {}, dual: {}, plural: {} }
    for (const num of NOUN_NUMBERS) {
        for (const c of NOUN_CASES) {
            try {
                result[num][c] = declineWordAutomatically({
                    dbItem: asNStemIfMisfiled({
                        interslavic: src.stem || src.coreValue || src.value,
                        protoSlavic: src.proto || "",
                        gender: resolveGender(src.gender, src.protoStemClass ?? undefined),
                        animacy: src.animacy || undefined,
                        protoStemClass: src.protoStemClass || "u",
                        stemExtension: src.stemExtension || undefined,
                        paradigm: (src.paradigm || "A") as AccentParadigm,
                        stressPosition: src.stressPosition,
                        morphemes: src.roots?.map((r) => ({ value: r.value, stressPosition: r.stressPosition })),
                    }),
                    targetCase: c,
                    targetNumber: num,
                })
            } catch {
                result[num][c] = "—"
            }
        }
    }
    return result
}

/**
 * "Механический хвост" (глагол + sę/se и/или известный предлог) спрягается
 * только в голове, хвост приклеивается ко всем формам (verb/mechanicalTail.ts).
 * Модель - та же, что у корпусного движка (processVerb): канонический
 * инфинитив по стему, основы настоящего времени и l-причастия, класс.
 */
export function buildVerbParadigm(src: ParadigmSource, knownPrepositions: string[]): ConjugationResult | null {
    if (src.pos !== PosType.VERB || src.isCollocation) return null
    const { head, tailSuffix } = splitMechanicalVerbTail(src.value, knownPrepositions)
    return appendTailToConjugation(conjugateFullVerb(buildVerbModel({
        head,
        stem: src.stem,
        secondaryStem: src.secondaryStem,
        tertiaryStem: src.tertiaryStem,
        aspect: (src.aspect as VerbalAspect) || VerbalAspect.IPF,
        paradigm: (src.paradigm as AccentParadigm) || AccentParadigm.A,
    })), tailSuffix)
}

export type AdjectiveDegree = "pos" | "comp" | "sup"
export const ADJECTIVE_CASES = [Case.NOMINATIVE, Case.GENITIVE, Case.DATIVE, Case.ACCUSATIVE, Case.INSTRUMENTAL, Case.LOCATIVE, Case.VOCATIVE] as const
export const ADJECTIVE_NUMBERS = [NumberType.SINGULAR, NumberType.DUAL, NumberType.PLURAL] as const

/** Прилагательное: число -> падеж -> форма для одного рода и степени. */
export function buildAdjectiveColumns(
    src: Pick<ParadigmSource, "value" | "paradigm" | "protoStemClass">,
    gender: GrammaticalGender,
    degree: AdjectiveDegree,
): Record<string, Record<string, string>> {
    const dbItem: EnhancedAdjDbItem = {
        interslavic: src.value,
        protoSlavic: src.value,
        paradigm: (src.paradigm || "A") as AccentParadigm,
        protoStemClass: (src.protoStemClass || "o") as ProtoStemClass,
    }
    const columns: Record<string, Record<string, string>> = {}
    for (const n of ADJECTIVE_NUMBERS) {
        columns[n] = {}
        for (const c of ADJECTIVE_CASES) {
            columns[n][c] = generateAdjectiveForm({ dbItem, targetCase: c, targetNumber: n, targetGender: gender, degree })
        }
    }
    return columns
}

// Строка lexemes (getItem() в app/words/[id]/api.ts, loadLexemeRow в lib/bots) -> ParadigmSource. getItem
// возвращает нетипизированный объект, поэтому поля читаются здесь, в одном месте.
interface WordItemLike {
    pos?: string | null
    value?: string | null
    stem?: string | null
    secondaryStem?: string | null
    tertiaryStem?: string | null
    aspect?: string | null
    paradigm?: string | null
    gender?: string | null
    animacy?: string | null
    protoStemClass?: string | null
    stemExtension?: string | null
    stressPosition?: number | null
    isCollocation?: boolean | number | null
    proto?: string | null
    word?: { value?: string | null } | null
    roots?: { value: string; stressPosition?: number | null }[] | null
}

export function toParadigmSource(item: WordItemLike): ParadigmSource {
    return {
        pos: item.pos,
        value: item.value ?? "",
        stem: item.stem,
        secondaryStem: item.secondaryStem,
        tertiaryStem: item.tertiaryStem,
        aspect: item.aspect,
        paradigm: item.paradigm,
        gender: item.gender,
        animacy: item.animacy,
        protoStemClass: item.protoStemClass,
        stemExtension: item.stemExtension,
        stressPosition: item.stressPosition,
        isCollocation: item.isCollocation,
        proto: item.proto,
        coreValue: item.word?.value,
        roots: item.roots ?? undefined,
    }
}
