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
 * Только новые страницы: npm run crawl:isv-wikipedia -- --new-only
 * Только список недостающих страниц: npm run crawl:isv-wikipedia -- --new-only --dry-run
 * Пропустить страницы до ID прошлого сбора включительно: --after-page-id=5685
 * Без пересчёта словаря: --skip-frequencies
 * Ограничить количество страниц (для теста): CRAWL_LIMIT=20 npm run crawl:isv-wikipedia
 */
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { resolveDatabaseUrls } from "@/lib/databaseUrls"
import { listArticles, fetchArticleExtract, type WikiArticleMeta } from "@/lib/corpus/wikipedia/isvWikipediaClient"

const EXTRACT_FETCH_DELAY_MS = 300
const CRAWL_LIMIT = process.env.CRAWL_LIMIT ? Number(process.env.CRAWL_LIMIT) : undefined
const newOnly = process.argv.includes("--new-only")
const dryRun = process.argv.includes("--dry-run")
const skipFrequencies = process.argv.includes("--skip-frequencies")
const checkpoint = process.argv.find((arg) => arg.startsWith("--after-page-id="))
const afterPageId = checkpoint === undefined ? 0 : Number(checkpoint.split("=")[1])
if (!Number.isSafeInteger(afterPageId) || afterPageId < 0) throw new Error("Некорректный --after-page-id")

if (!process.env.DATA_DATABASE_URL && process.env.SQLITE_DB) {
    process.env.DATA_DATABASE_URL = `file:${resolve(process.env.SQLITE_DB)}`
}
const dataUrl = resolveDatabaseUrls().data
process.env.SQLITE_DB = dataUrl.startsWith("file://") ? fileURLToPath(dataUrl) : dataUrl.replace(/^file:/, "")

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

async function loadImporter() {
    const { buildCollocationRecords, createDbAnalyzer } = await import("@/lib/corpus/tokenizer/analyzer-factory")
    const { CollocationMatcher } = await import("@/lib/corpus/tokenizer/collocationMatcher")
    const { upsertCorpusDocument } = await import("@/lib/corpus/upsertDocument")
    const analyzer = await createDbAnalyzer()
    const matcher = new CollocationMatcher(await buildCollocationRecords())
    return (article: WikiArticleMeta, rawText: string) => upsertCorpusDocument({
        title: article.title,
        slug: `iswiki-${article.pageId}`,
        rawText,
        language: "is",
        genre: "encyclopedic",
        externalId: externalIdFor(article.pageId),
        sourceUrl: article.fullUrl,
        sourceRevisionId: article.revisionId,
        createOnly: newOnly,
    }, analyzer, matcher)
}

async function crawl(prismaCorpus: PrismaCorpusClient) {
    console.log("Собираю список статей isv.wikipedia.org...")

    let importArticle: Awaited<ReturnType<typeof loadImporter>> | undefined
    let seen = 0
    let pending = 0
    let created = 0
    let updated = 0
    let skippedExisting = 0
    let skippedBeforeCheckpoint = 0
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

            if (newOnly && knownRevisions.has(externalId)) {
                skippedExisting++
                continue
            }
            if (article.pageId <= afterPageId) {
                skippedBeforeCheckpoint++
                continue
            }
            if (knownRevisionId !== undefined && knownRevisionId === article.revisionId) {
                skippedUnchanged++
                continue
            }

            if (dryRun) {
                pending++
                console.log(`${article.pageId}\t${article.title}`)
                continue
            }

            try {
                await sleep(EXTRACT_FETCH_DELAY_MS)
                const rawText = (await fetchArticleExtract(article.pageId)).trim()

                if (!rawText) {
                    skippedEmpty++
                    continue
                }

                importArticle ??= await loadImporter()
                const result = await importArticle(article, rawText)

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
    if (dryRun) console.log(`К импорту: ${pending}`)
    console.log(`Создано: ${created}`)
    console.log(`Обновлено: ${updated}`)
    if (newOnly) console.log(`Пропущено (уже в корпусе): ${skippedExisting}`)
    if (afterPageId) console.log(`Пропущено (до контрольного ID): ${skippedBeforeCheckpoint}`)
    console.log(`Пропущено (без изменений): ${skippedUnchanged}`)
    console.log(`Пропущено (пустой текст): ${skippedEmpty}`)
    console.log(`Ошибок: ${failed}`)

    if (failed > 0) process.exitCode = 1

    if (!skipFrequencies && (created > 0 || updated > 0)) {
        console.log("\nПересчитываю частотность и CEFR-уровни...")
        try {
            const { computeLexiconFrequencies } = await import("@/lib/corpus/frequencies/compute-frequencies")
            const { computeCefrLevels } = await import("@/lib/corpus/frequencies/compute-cefr-levels")
            await computeLexiconFrequencies()
            await computeCefrLevels()
            console.log("Готово.")
        } catch (e) {
            console.error("Пересчёт частотности не удался:", e)
            process.exitCode = 1
        }
    }
}

async function main() {
    const { prismaCorpus, prismaData } = await importPrisma()
    try {
        await crawl(prismaCorpus)
    } finally {
        await Promise.all([prismaCorpus.$disconnect(), prismaData.$disconnect()])
    }
}

main().catch((err) => {
    console.error("Краулер завершился с ошибкой:", err)
    process.exitCode = 1
})
