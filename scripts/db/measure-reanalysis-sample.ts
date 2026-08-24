// Прогон анализатора «вхолостую» по уже существующим токенам выборки
// документов: считает, как распределились бы токены по светофору
// (зелёный/жёлтый/красный/омонимичный) при текущем коде, и сравнивает с тем,
// что записано в corpus.db сейчас. Ничего не пишет — нужен, чтобы оценить
// эффект правки распознавания до массового реанализа живого корпуса.
//
// ВАЖНО: запускать с преднагрузкой dotenv, иначе Prisma откроет
// prisma/interlex.db (пустой артефакт), а не настоящую БД в корне репозитория
// — см. AGENTS.md, «Corpus Candidate Proposals», п.2 про tsx и hoisting:
//   npx tsx -r dotenv/config scripts/db/measure-reanalysis-sample.ts [docs] [offset]

import { prismaCorpus } from "@/lib/prisma"
import { buildCollocationRecords, createDbAnalyzer } from "@/lib/corpus/tokenizer/analyzer-factory"
import { CollocationMatcher } from "@/lib/corpus/tokenizer/collocationMatcher"

type Bucket = "green" | "ambiguous" | "yellow" | "red" | "punct"

function bucketOf(matchCount: number, isPartialMatch: boolean, isPunct: boolean): Bucket {
    if (isPunct) return "punct"
    if (matchCount === 0) return "red"
    if (isPartialMatch) return "yellow"
    if (matchCount > 1) return "ambiguous"
    return "green"
}

async function main() {
    const docLimit = process.argv[2] ? parseInt(process.argv[2], 10) : 50
    const offset = process.argv[3] ? parseInt(process.argv[3], 10) : 0

    const analyzer = await createDbAnalyzer()
    const collocationMatcher = new CollocationMatcher(await buildCollocationRecords())

    const docs = await prismaCorpus.corpusDocument.findMany({
        select: { slug: true },
        orderBy: { slug: "asc" },
        skip: offset,
        take: docLimit,
    })

    const before: Record<Bucket, number> = { green: 0, ambiguous: 0, yellow: 0, red: 0, punct: 0 }
    const after: Record<Bucket, number> = { green: 0, ambiguous: 0, yellow: 0, red: 0, punct: 0 }
    // Формы, которые были красными и перестали ими быть — выборочно, чтобы
    // глазами проверить, что распознались осмысленные слова, а не мусор.
    const recovered = new Map<string, number>()
    // И обратное направление: что распознавалось, а теперь нет.
    const lost = new Map<string, number>()
    // Что осталось красным — вход для следующей итерации по распознаванию.
    const stillRed = new Map<string, number>()

    for (const { slug } of docs) {
        const tokens = await prismaCorpus.corpusToken.findMany({
            where: { documentSlug: slug },
            select: { surfaceForm: true, wordIndex: true, sentenceId: true, matchCount: true, isPartialMatch: true },
            orderBy: { tokenIndex: "asc" },
        })

        const bySentence = new Map<string, typeof tokens>()
        for (const t of tokens) {
            const arr = bySentence.get(t.sentenceId)
            if (arr) arr.push(t)
            else bySentence.set(t.sentenceId, [t])
        }

        for (const sentenceTokens of bySentence.values()) {
            const surfaceForms = sentenceTokens.map((t) => t.surfaceForm)
            let i = 0
            while (i < sentenceTokens.length) {
                const token = sentenceTokens[i]
                const wasBucket = bucketOf(token.matchCount, token.isPartialMatch, token.wordIndex === -1)
                before[wasBucket]++

                if (token.wordIndex === -1) {
                    after.punct++
                    i++
                    continue
                }

                const collocationMatch = collocationMatcher.matchAt(surfaceForms, i)
                if (collocationMatch) {
                    for (let k = 0; k < collocationMatch.length; k++) {
                        if (k > 0) before[bucketOf(sentenceTokens[i + k].matchCount, sentenceTokens[i + k].isPartialMatch, false)]++
                        after.green++
                    }
                    i += collocationMatch.length
                    continue
                }

                const leftNeighbor = i > 0 ? surfaceForms[i - 1] : undefined
                const analysis = await analyzer.analyzeWord(token.surfaceForm, { leftNeighbor })
                const nowBucket: Bucket = analysis
                    ? bucketOf(analysis.matchCount ?? 0, !!analysis.isPartialMatch, false)
                    : "red"
                after[nowBucket]++

                const key = token.surfaceForm.toLowerCase()
                if (wasBucket === "red" && nowBucket !== "red") recovered.set(key, (recovered.get(key) ?? 0) + 1)
                if (wasBucket !== "red" && nowBucket === "red") lost.set(key, (lost.get(key) ?? 0) + 1)
                if (nowBucket === "red") stillRed.set(key, (stillRed.get(key) ?? 0) + 1)
                i++
            }
        }
    }

    const words = (b: Record<Bucket, number>) => b.green + b.ambiguous + b.yellow + b.red
    console.log(`\nДокументов: ${docs.length}, словных токенов: ${words(before).toLocaleString("ru")}\n`)
    console.log(`${"".padEnd(11)}${"было".padStart(12)}${"стало".padStart(12)}${"дельта".padStart(12)}`)
    for (const k of ["green", "ambiguous", "yellow", "red"] as const) {
        const d = after[k] - before[k]
        console.log(
            `${k.padEnd(11)}${before[k].toLocaleString("ru").padStart(12)}${after[k].toLocaleString("ru").padStart(12)}` +
            `${((d >= 0 ? "+" : "") + d.toLocaleString("ru")).padStart(12)}` +
            `   ${(after[k] / words(after) * 100).toFixed(1)}%`
        )
    }

    const top = (m: Map<string, number>, n: number) =>
        [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)

    const recoveredTotal = [...recovered.values()].reduce((s, c) => s + c, 0)
    console.log(`\nСтали распознаваться: ${recovered.size} форм, ${recoveredTotal.toLocaleString("ru")} вхождений`)
    for (const [form, c] of top(recovered, 20)) console.log(`  ${form.padEnd(24)} ${c}`)

    const stillRedTotal = [...stillRed.values()].reduce((s, c) => s + c, 0)
    console.log(`\nОсталось красными: ${stillRed.size} форм, ${stillRedTotal.toLocaleString("ru")} вхождений`)
    for (const [form, c] of top(stillRed, 25)) console.log(`  ${form.padEnd(24)} ${c}`)

    const lostTotal = [...lost.values()].reduce((s, c) => s + c, 0)
    console.log(`\nПерестали распознаваться: ${lost.size} форм, ${lostTotal.toLocaleString("ru")} вхождений`)
    for (const [form, c] of top(lost, 20)) console.log(`  ${form.padEnd(24)} ${c}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prismaCorpus.$disconnect())
