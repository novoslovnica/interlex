import { prismaCorpus, prismaData } from "@/lib/prisma"
import { parseHomonymGroupKey } from "@/lib/corpus/homonymGroup"
import {
    aggregateDuplicatePairs,
    assembleHomonymDuplicates,
    summarizeHomonymDuplicates,
    type DuplicateGroupResult,
    type DuplicatePairAgg,
    type DuplicateTotals,
    type LexemeMeta,
} from "@/lib/corpus/homonymDuplicates"

/**
 * Данные отчёта по дублям для страницы /admin/corpus/homonym-duplicates.
 *
 * Группы берутся по индексированному CorpusToken.homonymGroupKey (составной
 * индекс (homonymGroupKey, documentSlug) покрывает и COUNT(*), и
 * COUNT(DISTINCT documentSlug)), метаданные лексем — из interlex.db. Границу баз
 * в одном запросе не пересекаем (AGENTS.md): два запроса, сборка в памяти.
 *
 * Вся классификация — в чистом lib/corpus/homonymDuplicates.ts, чтобы страница
 * и CLI считали одинаково.
 */

export interface HomonymDuplicateReport {
    /** Группы форм, в которых нашлась хотя бы одна пара-дубль. */
    groups: DuplicateGroupResult[]
    /** Те же пары, агрегированные (один дубль всплывает во многих формах). */
    pairs: DuplicatePairAgg[]
    totals: DuplicateTotals
}

export async function fetchHomonymDuplicateReport(): Promise<HomonymDuplicateReport> {
    const raw = await prismaCorpus.$queryRaw<
        { groupKey: string; tokenCount: bigint; documentCount: bigint }[]
    >`
        SELECT "homonymGroupKey" AS groupKey,
               COUNT(*) AS tokenCount,
               COUNT(DISTINCT "documentSlug") AS documentCount
        FROM "CorpusToken"
        WHERE "homonymGroupKey" IS NOT NULL
        GROUP BY "homonymGroupKey"
    `
    const groups = raw.map((r) => ({
        groupKey: r.groupKey,
        tokenCount: Number(r.tokenCount),
        documentCount: Number(r.documentCount),
    }))

    const slugs = new Set<string>()
    for (const g of groups) {
        for (const s of parseHomonymGroupKey(g.groupKey)?.wordSlugs ?? []) slugs.add(s)
    }

    const lexemes = new Map<string, LexemeMeta>()
    const list = [...slugs]
    // Порциями: SQLite ограничивает число параметров в IN.
    const CHUNK = 500
    for (let i = 0; i < list.length; i += CHUNK) {
        const rows = await prismaData.lexeme.findMany({
            where: { slug: { in: list.slice(i, i + CHUNK) } },
            select: {
                slug: true,
                value: true,
                pos: true,
                gender: true,
                animacy: true,
                stem: true,
                paradigm: true,
                corpusFrequencyPerMln: true,
            },
        })
        for (const r of rows) lexemes.set(r.slug, r)
    }

    const assembled = assembleHomonymDuplicates(groups, lexemes)
    return {
        groups: assembled,
        pairs: aggregateDuplicatePairs(assembled),
        totals: summarizeHomonymDuplicates(assembled),
    }
}
