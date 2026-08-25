// Массовый синтаксический разбор корпуса: строит dependency-граф (UD) над
// уже размеченными токенами всех документов.
//
// Отдельный шаг от реанализа: тот перезапускает токенизатор и переписывает
// разметку, этот только читает готовые lemma/pos/feats и пишет рёбра в
// CorpusDependency. Ручные рёбра (source='manual') не затрагиваются —
// saveDependencies удаляет и пересоздаёт только 'auto'.
//
// Идёт тем же кодом, что и кнопка в админке (parseDocumentSyntax).
//
// Prisma 7 подтекает памятью на длинных сериях $transaction (см. AGENTS.md),
// поэтому есть [limit] [offset]: прогон можно разбить на несколько процессов,
// каждый документ обрабатывается независимо и повторно — безопасно.
// Документы берутся в стабильном порядке по slug.
//
// Пути к БД проставляются здесь же, до динамического импорта — dotenv не
// нужен (тот же приём, что в scripts/compute-lexicon-frequency.ts).
//
// Usage:
//   npx tsx scripts/db/parse-syntax-all-documents.ts            # весь корпус
//   npx tsx scripts/db/parse-syntax-all-documents.ts 500        # первые 500
//   npx tsx scripts/db/parse-syntax-all-documents.ts 500 1000   # 500 со смещения 1000

import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`
process.env.CORPUS_DATABASE_URL = `file:${path.resolve(process.cwd(), "corpus.db")}`

async function main() {
    const { prismaCorpus } = await import("@/lib/prisma")
    const { parseDocumentSyntax } = await import("@/lib/corpus/syntax/parseDocument")

    const limit = process.argv[2] ? parseInt(process.argv[2], 10) : undefined
    const offset = process.argv[3] ? parseInt(process.argv[3], 10) : 0

    const docs = await prismaCorpus.corpusDocument.findMany({
        select: { slug: true },
        orderBy: { slug: "asc" },
        ...(offset ? { skip: offset } : {}),
        ...(limit ? { take: limit } : {}),
    })

    console.log(`Документов к разбору: ${docs.length} (смещение ${offset})`)

    let sentences = 0
    let edges = 0
    let errors = 0
    const start = Date.now()

    for (let i = 0; i < docs.length; i++) {
        try {
            const result = await parseDocumentSyntax(docs[i].slug)
            if (result) {
                sentences += result.sentencesProcessed
                edges += result.edgesWritten
            }
        } catch (e) {
            errors++
            console.error(`  [${i + 1}/${docs.length}] СБОЙ slug=${docs[i].slug}:`, e instanceof Error ? e.message : e)
        }

        if ((i + 1) % 25 === 0 || i === docs.length - 1) {
            const elapsed = (Date.now() - start) / 1000
            console.log(
                `[${i + 1}/${docs.length}] ${elapsed.toFixed(0)}с, ${((i + 1) / elapsed).toFixed(2)} док/с, ` +
                `предложений ${sentences}, рёбер ${edges}, сбоев ${errors}`
            )
        }
    }

    const total = await prismaCorpus.corpusDependency.count()
    console.log(`\n=== Готово за ${((Date.now() - start) / 1000).toFixed(0)}с ===`)
    console.log(`Документов:            ${docs.length}, сбоев: ${errors}`)
    console.log(`Предложений разобрано: ${sentences}`)
    console.log(`Рёбер записано:        ${edges}`)
    console.log(`Всего в CorpusDependency: ${total}`)

    process.exit(0)
}

main().catch((e) => { console.error("Fatal error:", e); process.exit(1) })
