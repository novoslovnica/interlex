/**
 * Краулер interslavic Wikipedia (isv.wikipedia.org) для наполнения корпуса.
 *
 * Идемпотентность: каждый документ помечается externalId вида "iswiki:<pageId>"
 * и sourceRevisionId (MediaWiki revid). При повторном запуске:
 *  - страницы с неизменившимся revisionId полностью пропускаются;
 *  - изменившиеся или новые страницы токенизируются и записываются через
 *    upsertCorpusDocument, которая для уже существующего документа удаляет
 *    старые segments/sentences/tokens и создаёт новые в одной транзакции —
 *    токены не накапливаются поверх старых.
 *
 * Запуск: npm run crawl:isv-wikipedia
 * Ограничить количество страниц (для теста): CRAWL_LIMIT=20 npm run crawl:isv-wikipedia
 */
import * as path from "path"

// Реальные .db-файлы лежат в корне репозитория, а не в prisma/ (см. CLAUDE.md).
// Скрипт запускается через `npx tsx` в обход Next.js, поэтому lib/prisma.ts не
// получит эти пути от Next-рантайма — выставляем их сами до импорта модулей,
// которые транзитивно тянут lib/prisma (используем динамический import, чтобы
// эти присваивания гарантированно выполнились раньше вычисления модуля).
process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`
process.env.CORPUS_DATABASE_URL = `file:${path.resolve(process.cwd(), "corpus.db")}`

import { listArticles, fetchArticleExtract, WikiArticleMeta } from "@/lib/corpus/wikipedia/isvWikipediaClient"

const EXTRACT_FETCH_DELAY_MS = 300
const CRAWL_LIMIT = process.env.CRAWL_LIMIT ? Number(process.env.CRAWL_LIMIT) : undefined

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function externalIdFor(pageId: number): string {
    return `iswiki:${pageId}`
}

type PrismaCorpusClient = Awaited<ReturnType<typeof importPrisma>>["prismaCorpus"]

function importPrisma() {
    return import("@/lib/prisma")
}

async function loadKnownRevisions(
    prismaCorpus: PrismaCorpusClient,
    externalIds: string[],
): Promise<Map<string, number | null>> {
    if (externalIds.length === 0) return new Map()
    const rows = await prismaCorpus.corpusDocument.findMany({
        where: { externalId: { in: externalIds } },
        select: { externalId: true, sourceRevisionId: true },
    })
    const map = new Map<string, number | null>()
    for (const row of rows) {
        if (row.externalId) map.set(row.externalId, row.sourceRevisionId)
    }
    return map
}

async function main() {
    const { prismaCorpus } = await importPrisma()
    const { buildCollocationRecords, createDbAnalyzer } = await import("@/lib/corpus/tokenizer/analyzer-factory")
    const { CollocationMatcher } = await import("@/lib/corpus/tokenizer/collocationMatcher")
    const { upsertCorpusDocument } = await import("@/lib/corpus/upsertDocument")
    const { computeLexiconFrequencies } = await import("@/lib/corpus/frequencies/compute-frequencies")
    const { computeCefrLevels } = await import("@/lib/corpus/frequencies/compute-cefr-levels")

    console.log("Собираю список статей isv.wikipedia.org...")

    const analyzer = await createDbAnalyzer()
    const collocationMatcher = new CollocationMatcher(await buildCollocationRecords())

    let seen = 0
    let created = 0
    let updated = 0
    let skippedUnchanged = 0
    let skippedEmpty = 0
    let failed = 0

    let batch: WikiArticleMeta[] = []
    const BATCH_SIZE = 100

    async function processBatch(articles: WikiArticleMeta[]) {
        const knownRevisions = await loadKnownRevisions(prismaCorpus, articles.map((a) => externalIdFor(a.pageId)))

        for (const article of articles) {
            if (CRAWL_LIMIT !== undefined && seen >= CRAWL_LIMIT) return
            seen++

            const externalId = externalIdFor(article.pageId)
            const knownRevisionId = knownRevisions.get(externalId)

            if (knownRevisionId !== undefined && knownRevisionId === article.revisionId) {
                skippedUnchanged++
                continue
            }

            try {
                await sleep(EXTRACT_FETCH_DELAY_MS)
                const rawText = (await fetchArticleExtract(article.pageId)).trim()

                if (!rawText) {
                    skippedEmpty++
                    continue
                }

                const result = await upsertCorpusDocument(
                    {
                        title: article.title,
                        slug: `iswiki-${article.pageId}`,
                        rawText,
                        language: "is",
                        genre: "encyclopedic",
                        externalId,
                        sourceUrl: article.fullUrl,
                        sourceRevisionId: article.revisionId,
                    },
                    analyzer,
                    collocationMatcher,
                )

                if (result.status === "created") {
                    created++
                    console.log(`+ ${article.title} (${result.tokensProcessed} токенов)`)
                } else if (result.status === "updated") {
                    updated++
                    console.log(`~ ${article.title} (${result.tokensProcessed} токенов)`)
                }
            } catch (err) {
                failed++
                console.error(`! Ошибка на странице "${article.title}" (pageId=${article.pageId}):`, err)
            }
        }
    }

    for await (const article of listArticles()) {
        if (CRAWL_LIMIT !== undefined && seen + batch.length >= CRAWL_LIMIT) {
            batch.push(article)
            break
        }
        batch.push(article)
        if (batch.length >= BATCH_SIZE) {
            await processBatch(batch)
            batch = []
        }
        if (CRAWL_LIMIT !== undefined && seen >= CRAWL_LIMIT) break
    }
    if (batch.length > 0) {
        await processBatch(batch)
    }

    console.log("\n--- Итог ---")
    console.log(`Просмотрено: ${seen}`)
    console.log(`Создано: ${created}`)
    console.log(`Обновлено: ${updated}`)
    console.log(`Пропущено (без изменений): ${skippedUnchanged}`)
    console.log(`Пропущено (пустой текст): ${skippedEmpty}`)
    console.log(`Ошибок: ${failed}`)

    if (created > 0 || updated > 0) {
        console.log("\nПересчитываю частотность и CEFR-уровни...")
        try {
            await computeLexiconFrequencies()
            await computeCefrLevels()
            console.log("Готово.")
        } catch (e) {
            console.error("Пересчёт частотности не удался:", e)
        }
    }

    await prismaCorpus.$disconnect()
}

main().catch((err) => {
    console.error("Краулер завершился с ошибкой:", err)
    process.exitCode = 1
})
