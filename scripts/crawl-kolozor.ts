/**
 * Краулер журнала Kolozor (kolozor.com) — берёт только латиничную версию
 * публикаций (/en/ в постоянной ссылке), см. lib/corpus/sources/
 * kolozorClient.ts. externalId "kolozor:<id>" + sourceRevisionId = unix-время
 * modified_gmt из WP REST API — идемпотентно, как и остальные краулеры.
 *
 * Запуск: npm run crawl:kolozor
 * Ограничить (для теста): CRAWL_LIMIT=10 npm run crawl:kolozor
 */
import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`
process.env.CORPUS_DATABASE_URL = `file:${path.resolve(process.cwd(), "corpus.db")}`

import { listKolozorLatinArticles } from "@/lib/corpus/sources/kolozorClient"

const CRAWL_LIMIT = process.env.CRAWL_LIMIT ? Number(process.env.CRAWL_LIMIT) : undefined

async function main() {
    const { prismaCorpus } = await import("@/lib/prisma")
    const { buildCollocationRecords, createDbAnalyzer } = await import("@/lib/corpus/tokenizer/analyzer-factory")
    const { CollocationMatcher } = await import("@/lib/corpus/tokenizer/collocationMatcher")
    const { upsertCorpusDocument } = await import("@/lib/corpus/upsertDocument")
    const { computeLexiconFrequencies } = await import("@/lib/corpus/frequencies/compute-frequencies")
    const { computeCefrLevels } = await import("@/lib/corpus/frequencies/compute-cefr-levels")

    const analyzer = await createDbAnalyzer()
    const collocationMatcher = new CollocationMatcher(await buildCollocationRecords())

    console.log("Собираю латиничные статьи kolozor.com/en/...")

    let seen = 0
    let created = 0
    let updated = 0
    let skippedUnchanged = 0
    let failed = 0

    for await (const article of listKolozorLatinArticles()) {
        if (CRAWL_LIMIT !== undefined && seen >= CRAWL_LIMIT) break
        seen++

        const externalId = `kolozor:${article.id}`

        try {
            const result = await upsertCorpusDocument(
                {
                    title: article.title,
                    slug: externalId.replace(":", "-"),
                    rawText: article.text,
                    language: "is",
                    genre: "publicistic",
                    externalId,
                    sourceUrl: article.url,
                    sourceRevisionId: article.modifiedAt,
                },
                analyzer,
                collocationMatcher,
            )

            if (result.status === "created") {
                created++
                console.log(`+ [${article.id}] ${article.title} (${result.tokensProcessed} токенов)`)
            } else if (result.status === "updated") {
                updated++
                console.log(`~ [${article.id}] ${article.title} (${result.tokensProcessed} токенов)`)
            } else {
                skippedUnchanged++
            }
        } catch (err) {
            failed++
            console.error(`! Ошибка на статье id=${article.id}:`, err)
        }
    }

    console.log("\n--- Итог ---")
    console.log(`Просмотрено: ${seen}`)
    console.log(`Создано: ${created}`)
    console.log(`Обновлено: ${updated}`)
    console.log(`Пропущено (без изменений): ${skippedUnchanged}`)
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
