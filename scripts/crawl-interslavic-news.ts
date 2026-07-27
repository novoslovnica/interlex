/**
 * Краулер interslavic.news для наполнения корпуса. Идентичный по духу
 * scripts/crawl-isv-wikipedia.ts паттерн (см. его комментарий вверху):
 * externalId "ilnews:<id>" + псевдо-revision (хэш текста, у сайта нет
 * собственного номера версии статьи) для идемпотентных перезапусков —
 * upsertCorpusDocument сам удаляет старые segments/sentences/tokens
 * документа перед повторной записью, если текст изменился.
 *
 * Запуск: npm run crawl:interslavic-news
 * Ограничить (для теста): CRAWL_LIMIT=10 npm run crawl:interslavic-news
 */
import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`
process.env.CORPUS_DATABASE_URL = `file:${path.resolve(process.cwd(), "corpus.db")}`

import { listNewsArticles, MAX_ARTICLE_ID_SCAN } from "@/lib/corpus/sources/interslavicNewsClient"
import { contentHash } from "@/lib/corpus/sources/htmlText"

const CRAWL_LIMIT = process.env.CRAWL_LIMIT ? Number(process.env.CRAWL_LIMIT) : undefined

async function main() {
    const { prismaCorpus } = await import("@/lib/prisma")
    const { DbAnalyzer } = await import("@/lib/corpus/tokenizer/dbAnalyzer")
    const { buildValidEndings, buildKnownPrepositions, buildCollocationRecords, createQueryWordsByBase } = await import("@/lib/corpus/tokenizer/analyzer-factory")
    const { CollocationMatcher } = await import("@/lib/corpus/tokenizer/collocationMatcher")
    const { upsertCorpusDocument } = await import("@/lib/corpus/upsertDocument")
    const { computeLexiconFrequencies } = await import("@/lib/corpus/frequencies/compute-frequencies")
    const { computeCefrLevels } = await import("@/lib/corpus/frequencies/compute-cefr-levels")

    const analyzer = new DbAnalyzer(createQueryWordsByBase(), await buildValidEndings(), await buildKnownPrepositions())
    const collocationMatcher = new CollocationMatcher(await buildCollocationRecords())

    console.log(`Сканирую interslavic.news (id 1..${MAX_ARTICLE_ID_SCAN})...`)

    let seen = 0
    let created = 0
    let updated = 0
    let skippedUnchanged = 0
    let failed = 0

    for await (const article of listNewsArticles()) {
        if (CRAWL_LIMIT !== undefined && seen >= CRAWL_LIMIT) break
        seen++

        const externalId = `ilnews:${article.id}`
        const sourceRevisionId = contentHash(article.text)

        try {
            const result = await upsertCorpusDocument(
                {
                    title: article.title,
                    slug: externalId.replace(":", "-"),
                    rawText: article.text,
                    language: "is",
                    genre: "news",
                    externalId,
                    sourceUrl: article.url,
                    sourceRevisionId,
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
