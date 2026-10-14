import { parseHomonymGroupKey } from "@/lib/corpus/homonymGroup"
import { expandSpellingVariants } from "@/lib/corpus/tokenizer/spellingVariants"
import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"

/**
 * Дубликаты лексем, найденные по группам массовой разметки омонимов
 * (roadmap п.111 → вход в дедупликацию, п.113).
 *
 * Модуль чистый: ни одной БД внутри. Данные (группы + метаданные лексем)
 * подают два разных потребителя, и оба обязаны классифицировать одинаково —
 * страница `/admin/corpus/homonym-duplicates` (данные через Prisma) и CLI
 * `scripts/db/analyze-homonym-duplicates.ts` (данные через better-sqlite3, чтобы
 * ходить в corpus.db без Prisma). Логика ровно здесь, копий нет.
 *
 * Зачем вообще: значительная часть групп омонимии — не омонимия, а один и тот
 * же словарный вход, записанный дважды (старый формат слага `drugy-adj` и новый
 * `drugy-ADJ`). Очередь подсказывает, какие дубли стоит слить первыми: чем
 * больше токенов у группы, тем больше разметки снимает одно слияние.
 */

export interface LexemeMeta {
    slug: string
    value: string | null
    pos: string | null
    gender: string | null
    animacy: string | null
    stem: string | null
    paradigm: string | null
    corpusFrequencyPerMln: number | null
}

/** Уровень доверия к паре — на что опирается совпадение. */
export type DuplicateTier =
    /** value совпадает буквально (регистр не в счёт). */
    | "identical-value"
    /** Отличаются только подтверждёнными парами написаний (u→ų, i→y, dž→đ). */
    | "confirmed-variant"
    /** Совпадает только после полной свёртки диакритики — гипотеза. */
    | "folded-only"

export interface DuplicatePair {
    kind: DuplicateTier
    /**
     * Единственный случай, который можно сливать не глядя: value, основа, род и
     * POS совпадают БУКВАЛЬНО. Всё остальное — гипотеза.
     * Контрпример, который даёт identical-value и НЕ является дублем: lexeme с
     * value «celo» и стемом «čel» («лоб») против value «celo» и стемом «cěl»
     * («целое») — разные слова, случайно записанные одинаково.
     */
    safe: boolean
    /** Один из слагов — старого формата (POS строчными: drugy-adj). */
    legacyPos: boolean
    /** Основы совпадают после свёртки (после свёртки, а не буквально). */
    sameStem: boolean
    /** Основы совпадают буквально. */
    stemEqRaw: boolean
    genderMismatch: boolean
    /** Слаг старого формата, если он один из двух. */
    legacySlug: string | null
    /** Другой слаг пары (новый формат, если legacySlug задан). */
    otherSlug: string
    /** Слаги пары как есть (для агрегации и ключа уникальности). */
    a: string
    b: string
}

export interface DuplicateGroupInput {
    groupKey: string
    tokenCount: number
    documentCount: number
}

export interface DuplicateGroupResult extends DuplicateGroupInput {
    form: string
    pairs: DuplicatePair[]
    lexemes: LexemeMeta[]
}

export interface DuplicateTotals {
    flaggedGroups: number
    tokensInFlagged: number
    pairsWithLegacy: number
    /** Уникальные пары лексем (один дубль встречается во многих группах форм). */
    distinctPairs: number
    distinctSafePairs: number
    distinctLegacyPairs: number
    kind: Record<DuplicateTier, { groups: number; pairs: number; tokens: number }>
    safe: { groups: number; pairs: number; tokens: number }
}

// POS — последний сегмент слага (value может содержать дефисы и запятые:
// "imeti, imati-VERB"). Старый формат писал POS строчными ("drugy-adj").
export function posOfSlug(slug: string): string {
    const i = slug.lastIndexOf("-")
    return i < 0 ? "" : slug.slice(i + 1)
}

export function isLegacyPosSlug(slug: string): boolean {
    const p = posOfSlug(slug)
    return p.length > 0 && p === p.toLowerCase() && p !== p.toUpperCase()
}

function folded(v: string | null): string {
    return v ? foldDiacritics(v.toLowerCase()) : ""
}

/**
 * Совпадение только по подтверждённым парам написаний (u→ų, i→y, dž→đ):
 * именно это мейнтейнер согласовал как «то же слово, упрощённая запись».
 * Собственной свёртки «похожих» букв здесь нет намеренно (AGENTS.md:
 * не выдумывать лингвистический факт).
 */
export function isConfirmedVariant(x: string | null, y: string | null): boolean {
    if (!x || !y) return false
    const lx = x.toLowerCase()
    const ly = y.toLowerCase()
    return expandSpellingVariants(lx).includes(ly) || expandSpellingVariants(ly).includes(lx)
}

/**
 * Пара лексем одной группы, которую стоит рассматривать как дубль, либо null.
 * Требуется совпадение POS (иначе это настоящая омонимия: ne-ADV/ne-INTJ).
 */
export function classifyDuplicatePair(a: LexemeMeta, b: LexemeMeta): DuplicatePair | null {
    if (!a.value || !b.value) return null
    if (a.pos !== b.pos) return null

    const rawEq = a.value.toLowerCase() === b.value.toLowerCase()
    const variantEq = isConfirmedVariant(a.value, b.value)
    const foldedEq = folded(a.value) === folded(b.value)
    if (!rawEq && !variantEq && !foldedEq) return null

    const kind: DuplicateTier = rawEq ? "identical-value" : (variantEq ? "confirmed-variant" : "folded-only")
    const stemEqRaw = (a.stem ?? "") === (b.stem ?? "")
    const genderMismatch = (a.gender ?? null) !== (b.gender ?? null)

    const aLegacy = isLegacyPosSlug(a.slug)
    const bLegacy = isLegacyPosSlug(b.slug)
    const legacySlug = aLegacy && !bLegacy ? a.slug : (bLegacy && !aLegacy ? b.slug : null)

    return {
        kind,
        // Безопасно только буквальное совпадение value + основы + рода при
        // совпадающем POS. Основа важна: свёртка слепа к č/c, ž/z, š/s, из-за
        // чего «čel» и «cěl» сливаются в «cel».
        safe: kind === "identical-value" && stemEqRaw && !genderMismatch,
        legacyPos: aLegacy !== bLegacy,
        sameStem: folded(a.stem) === folded(b.stem),
        stemEqRaw,
        genderMismatch,
        legacySlug,
        otherSlug: legacySlug === a.slug ? b.slug : a.slug,
        a: a.slug,
        b: b.slug,
    }
}

/**
 * Собирает отчёт по уже загруженным данным. Порядок групп — по убыванию
 * нагрузки (сколько токенов закроет слияние), как и в очереди омонимов.
 */
export function assembleHomonymDuplicates(
    groups: readonly DuplicateGroupInput[],
    lexemesBySlug: ReadonlyMap<string, LexemeMeta>,
): DuplicateGroupResult[] {
    const out: DuplicateGroupResult[] = []
    for (const g of groups) {
        const parsed = parseHomonymGroupKey(g.groupKey)
        if (!parsed) continue
        const ls = parsed.wordSlugs
            .map((s) => lexemesBySlug.get(s))
            .filter((l): l is LexemeMeta => Boolean(l))
        if (ls.length < 2) continue

        const pairs: DuplicatePair[] = []
        for (let i = 0; i < ls.length; i++) {
            for (let j = i + 1; j < ls.length; j++) {
                const p = classifyDuplicatePair(ls[i], ls[j])
                if (p) pairs.push(p)
            }
        }
        if (pairs.length === 0) continue
        out.push({ ...g, form: parsed.form, pairs, lexemes: ls })
    }
    return out.sort((x, y) => y.tokenCount - x.tokenCount)
}

/** Сводка по отчёту — одна точка правды для страницы и CLI. */
export function summarizeHomonymDuplicates(groups: readonly DuplicateGroupResult[]): DuplicateTotals {
    const kind: DuplicateTotals["kind"] = {
        "identical-value": { groups: 0, pairs: 0, tokens: 0 },
        "confirmed-variant": { groups: 0, pairs: 0, tokens: 0 },
        "folded-only": { groups: 0, pairs: 0, tokens: 0 },
    }
    const safe = { groups: 0, pairs: 0, tokens: 0 }
    let tokensInFlagged = 0
    let pairsWithLegacy = 0

    const distinct = new Map<string, DuplicatePair>()
    for (const g of groups) {
        tokensInFlagged += g.tokenCount
        const seenKinds = new Set<DuplicateTier>()
        let groupSafe = false
        for (const p of g.pairs) {
            kind[p.kind].pairs++
            seenKinds.add(p.kind)
            if (p.legacyPos) pairsWithLegacy++
            if (p.safe) { safe.pairs++; groupSafe = true }
            const id = [p.a, p.b].sort().join("~")
            if (!distinct.has(id)) distinct.set(id, p)
        }
        for (const k of seenKinds) {
            kind[k].groups++
            kind[k].tokens += g.tokenCount
        }
        if (groupSafe) { safe.groups++; safe.tokens += g.tokenCount }
    }

    const distinctList = [...distinct.values()]
    return {
        flaggedGroups: groups.length,
        tokensInFlagged,
        pairsWithLegacy,
        distinctPairs: distinctList.length,
        distinctSafePairs: distinctList.filter((p) => p.safe).length,
        distinctLegacyPairs: distinctList.filter((p) => p.legacyPos).length,
        kind,
        safe,
    }
}

export interface DuplicatePairAgg {
    pair: DuplicatePair
    /** Сколько групп форм затронуто этой парой. */
    groups: number
    /** Токенов в самой крупной такой группе. */
    maxTokens: number
    sumTokens: number
    maxDocuments: number
    /** До 5 примеров словоформ — чтобы было видно, «где это всплывает». */
    forms: string[]
}

/**
 * Один и тот же дубль всплывает во многих группах форм (drugy-ADJ/drugy-adj —
 * в 34). На ревью нужен список пар, а не групп: агрегируем и сортируем по
 * нагрузке на самой крупной группе.
 */
export function aggregateDuplicatePairs(groups: readonly DuplicateGroupResult[]): DuplicatePairAgg[] {
    const out = new Map<string, DuplicatePairAgg>()
    for (const g of groups) {
        for (const p of g.pairs) {
            const id = [p.a, p.b].sort().join("~")
            const cur = out.get(id) ?? { pair: p, groups: 0, maxTokens: 0, sumTokens: 0, maxDocuments: 0, forms: [] }
            cur.groups++
            cur.maxTokens = Math.max(cur.maxTokens, g.tokenCount)
            cur.sumTokens += g.tokenCount
            cur.maxDocuments = Math.max(cur.maxDocuments, g.documentCount)
            if (cur.forms.length < 5 && !cur.forms.includes(g.form)) cur.forms.push(g.form)
            out.set(id, cur)
        }
    }
    return [...out.values()].sort((x, y) => y.maxTokens - x.maxTokens)
}

/**
 * Примеры-контрпримеры: пары, которые выглядят дублями по написанию, но ими не
 * являются. Держим их рядом с отчётом в UI, чтобы никто не слил их «по аналогии».
 */
export const DUPLICATE_TRAP_EXAMPLES = [
    "biti-VERB (бить) и byti-VERB (быть) — разные глаголы, но подтверждённое правило i→y их роднит",
    "viti-VERB (вить) и vyti-VERB (выть) — то же самое",
    "žębra (жабры) и zebra (зебра) — свёртка приводит ž к z",
    "value «celo» со стемом «čel» (лоб) и value «celo» со стемом «cěl» (целое) — разные слова",
] as const
