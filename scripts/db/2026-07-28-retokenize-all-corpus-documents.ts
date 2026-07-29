/**
 * Перетокенизирует ВСЕ существующие документы корпуса исправленным
 * токенизатором (lib/corpus/tokenizer/tokenizer.ts — TOKEN_PATTERN раньше не
 * включал ę/ų/ć/đ/ľ/ń/ś/ź/ť/ď и т.п., разрывая такие слова на два токена).
 * Использует upsertCorpusDocument с уже сохранённым rawText каждого
 * документа, БЕЗ sourceRevisionId в payload — это заставляет функцию всегда
 * идти по ветке "существующий документ" (удалить старые segments/sentences/
 * tokens, перетокенизировать, записать заново), не трогая при этом реальный
 * sourceRevisionId в БД (Prisma игнорирует undefined-поля при update, так что
 * инкрементальность будущих запусков краулеров не ломается).
 *
 * Запуск: npx tsx scripts/db/2026-07-28-retokenize-all-corpus-documents.ts
 */
import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`
process.env.CORPUS_DATABASE_URL = `file:${path.resolve(process.cwd(), "corpus.db")}`

async function main() {
    const { prismaCorpus } = await import("@/lib/prisma")
    const { DbAnalyzer } = await import("@/lib/corpus/tokenizer/dbAnalyzer")
    const { CollocationMatcher } = await import("@/lib/corpus/tokenizer/collocationMatcher")
    const { buildValidEndings, buildKnownPrepositions, buildCollocationRecords, buildInflectionAnomalyIndex, createQueryWordsByBase } = await import("@/lib/corpus/tokenizer/analyzer-factory")
    const { upsertCorpusDocument } = await import("@/lib/corpus/upsertDocument")

    const analyzer = new DbAnalyzer(createQueryWordsByBase(), await buildValidEndings(), await buildKnownPrepositions(), await buildInflectionAnomalyIndex())
    const collocationMatcher = new CollocationMatcher(await buildCollocationRecords())

    const documents = await prismaCorpus.corpusDocument.findMany({
        select: { slug: true, title: true, rawText: true, author: true, language: true, genre: true, externalId: true, sourceUrl: true },
    })

    console.log(`Документов к перетокенизации: ${documents.length}`)

    let done = 0
    let failed = 0

    for (const doc of documents) {
        try {
            const result = await upsertCorpusDocument(
                {
                    title: doc.title,
                    slug: doc.slug,
                    rawText: doc.rawText,
                    author: doc.author ?? undefined,
                    language: doc.language,
                    genre: doc.genre,
                    externalId: doc.externalId ?? undefined,
                    sourceUrl: doc.sourceUrl ?? undefined,
                    // sourceRevisionId намеренно не передаём — форсирует retokenize
                },
                analyzer,
                collocationMatcher,
            )
            done++
            console.log(`~ [${doc.slug}] ${result.status === "updated" ? `${result.tokensProcessed} токенов` : result.status}`)
        } catch (err) {
            failed++
            console.error(`! Ошибка на документе ${doc.slug}:`, err)
        }
    }

    console.log(`\nГотово: ${done} документов перетокенизировано, ${failed} ошибок`)
    await prismaCorpus.$disconnect()
}

main().catch((err) => {
    console.error("Скрипт завершился с ошибкой:", err)
    process.exitCode = 1
})
