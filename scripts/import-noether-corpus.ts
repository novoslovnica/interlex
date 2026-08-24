/**
 * Импорт "Emmy Noether: Complete Interslavic Corpus Edition"
 * (https://github.com/KokunoYumeto/emmy-noether-isv) в корпус — по прямому
 * запросу мейнтейнера. Источник — LaTeX (43 статьи Noether + учебник по
 * алгебре "Work 44" + совместна statja Kapferera-Noether "Paper 45"),
 * конвертируется в текст через lib/noether/latexToText.ts (формулы и
 * математическая нотация выброшены целиком, окружающая межславянская
 * проза - нет). Библиография (bib-isv.tex) намеренно пропущена - список
 * литературы, не связный текст.
 *
 * Лицензия: CC0 на перевод/тайпсеттинг/метаданные (LICENSE в репозитории) -
 * сами работы Noether (1907-1930-е) в общественном достоянии, права не
 * выяснять не требуется, в отличие от коллекции Box.
 *
 * Важная оговорка из README источника: "machine-assisted scholarly working
 * edition... not peer-reviewed... no native-speaker, community, or external
 * certification is claimed" - межславянский текст не верифицирован
 * носителем/сообществом. Импортируем как есть (verified=false), решение о
 * качестве - на модератора.
 *
 * Запуск: npm run import:noether-corpus
 */
import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`
process.env.CORPUS_DATABASE_URL = `file:${path.resolve(process.cwd(), "corpus.db")}`

async function main() {
    const { prismaCorpus } = await import("@/lib/prisma")
    const { buildCollocationRecords, createDbAnalyzer } = await import("@/lib/corpus/tokenizer/analyzer-factory")
    const { CollocationMatcher } = await import("@/lib/corpus/tokenizer/collocationMatcher")
    const { upsertCorpusDocument } = await import("@/lib/corpus/upsertDocument")
    const { computeLexiconFrequencies } = await import("@/lib/corpus/frequencies/compute-frequencies")
    const { computeCefrLevels } = await import("@/lib/corpus/frequencies/compute-cefr-levels")
    const { contentHash } = await import("@/lib/corpus/sources/htmlText")
    const { fetchNoetherPapers1to43, fetchNoetherBook44, fetchNoetherPaper45 } = await import("@/lib/noether/noetherClient")

    const analyzer = await createDbAnalyzer()
    const collocationMatcher = new CollocationMatcher(await buildCollocationRecords())

    let created = 0
    let updated = 0
    let skipped = 0
    let failed = 0

    async function importWork(externalId: string, title: string, body: string, genre: string, sourceUrl: string) {
        try {
            const result = await upsertCorpusDocument(
                {
                    title,
                    slug: externalId.replace(/:/g, "-"),
                    rawText: body,
                    author: "Emmy Noether",
                    language: "is",
                    genre,
                    externalId,
                    sourceUrl,
                    sourceRevisionId: contentHash(body),
                },
                analyzer,
                collocationMatcher,
            )
            if (result.status === "created") { created++; console.log(`+ [${externalId}] ${title}`) }
            else if (result.status === "updated") { updated++; console.log(`~ [${externalId}] ${title}`) }
            else skipped++
        } catch (err) {
            failed++
            console.error(`! [${externalId}]`, err instanceof Error ? err.message : err)
        }
    }

    console.log("Скачиваю papers 1-43 (base-papers1-43-isv.tex)...")
    const papers = await fetchNoetherPapers1to43()
    for (const p of papers) {
        await importWork(`noether:papers1-43:${p.id}`, p.title, p.body, "academic", "https://github.com/KokunoYumeto/emmy-noether-isv/blob/main/source/base-papers1-43-isv.tex")
    }

    console.log("Скачиваю Work 44 (44-book-isv.tex)...")
    const book = await fetchNoetherBook44()
    for (const b of book) {
        await importWork(`noether:book44:${b.id}`, b.title, b.body, "textbook", "https://github.com/KokunoYumeto/emmy-noether-isv/blob/main/source/44-book-isv.tex")
    }

    console.log("Скачиваю Paper 45 (45-isv.tex)...")
    const p45 = await fetchNoetherPaper45()
    await importWork("noether:paper45", p45.title, p45.body, "academic", "https://github.com/KokunoYumeto/emmy-noether-isv/blob/main/source/45-isv.tex")

    console.log("\n--- Итог ---")
    console.log(`Создано: ${created}`)
    console.log(`Обновлено: ${updated}`)
    console.log(`Пропущено (без изменений): ${skipped}`)
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
    console.error("Импорт emmy-noether-isv завершился с ошибкой:", err)
    process.exitCode = 1
})
