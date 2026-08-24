// Ищет пары лексем, конкурирующих за одни и те же словоформы корпуса.
//
// Зачем: текущий поиск дубликатов (/admin/deduplication) сравнивает CORE-
// аллофоны на точное равенство строк с LIMIT 100 — он не видит ни "to"/"tȯj",
// ни "selo"/"sel", ни "životų"/"zivot", то есть ровно те пары, которые в
// корпусе реально дерутся за токены. Конкуренция за словоформу — куда более
// прямой признак дубликата, чем совпадение написания, и сразу даёт цену
// вопроса: сколько токенов чинит одно слияние.
//
// Прогон вхолостую: ничего не пишет ни в corpus.db, ни в interlex.db.
//
// Usage:
//   npx tsx -r dotenv/config scripts/db/find-competing-lexemes.ts [docs] [offset]
//   npx tsx -r dotenv/config scripts/db/find-competing-lexemes.ts all

import { prismaCorpus, prismaData } from "@/lib/prisma"
import { buildCollocationRecords, createDbAnalyzer } from "@/lib/corpus/tokenizer/analyzer-factory"
import { CollocationMatcher } from "@/lib/corpus/tokenizer/collocationMatcher"

interface PairStat {
    a: string
    b: string
    tokens: number
    forms: Set<string>
}

// Слаги в словаре двух поколений импорта: "-NOUN"/"-VERB"/"-ADJ" (верхний
// регистр) и "-noun"/"-adj"/"-v"/"-n" (нижний). Пара из разных поколений —
// сильный признак того, что это одно и то же слово, занесённое дважды.
function slugGeneration(slug: string): "up" | "low" {
    return /-[A-Z]{2,}$/.test(slug) ? "up" : "low"
}

async function main() {
    const arg = process.argv[2]
    const docLimit = arg === "all" ? undefined : arg ? parseInt(arg, 10) : 200
    const offset = process.argv[3] ? parseInt(process.argv[3], 10) : 0

    const analyzer = await createDbAnalyzer()
    const collocationMatcher = new CollocationMatcher(await buildCollocationRecords())

    const docs = await prismaCorpus.corpusDocument.findMany({
        select: { slug: true },
        orderBy: { slug: "asc" },
        skip: offset,
        ...(docLimit ? { take: docLimit } : {}),
    })

    const pairs = new Map<string, PairStat>()
    let tokensSeen = 0

    for (const { slug } of docs) {
        const tokens = await prismaCorpus.corpusToken.findMany({
            where: { documentSlug: slug, wordIndex: { not: -1 } },
            select: { surfaceForm: true, sentenceId: true, tokenIndex: true },
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
            for (let i = 0; i < sentenceTokens.length; i++) {
                if (collocationMatcher.matchAt(surfaceForms, i)) continue
                const leftNeighbor = i > 0 ? surfaceForms[i - 1] : undefined
                const analysis = await analyzer.analyzeWord(sentenceTokens[i].surfaceForm, { leftNeighbor })
                tokensSeen++
                const candidates = analysis?.candidates ?? []
                if (candidates.length < 2) continue

                // Все различные слаги, претендующие на эту словоформу.
                const slugs = [...new Set(candidates.map((c) => c.wordSlug).filter(Boolean))] as string[]
                if (slugs.length < 2) continue
                slugs.sort()
                for (let x = 0; x < slugs.length; x++) {
                    for (let y = x + 1; y < slugs.length; y++) {
                        const key = `${slugs[x]}|${slugs[y]}`
                        const stat = pairs.get(key)
                        if (stat) {
                            stat.tokens++
                            stat.forms.add(sentenceTokens[i].surfaceForm.toLowerCase())
                        } else {
                            pairs.set(key, { a: slugs[x], b: slugs[y], tokens: 1, forms: new Set([sentenceTokens[i].surfaceForm.toLowerCase()]) })
                        }
                    }
                }
            }
        }
    }

    const ranked = [...pairs.values()].sort((p, q) => q.tokens - p.tokens)
    const wanted = new Set<string>()
    for (const p of ranked.slice(0, 120)) { wanted.add(p.a); wanted.add(p.b) }
    const lexemes = await prismaData.lexeme.findMany({
        where: { slug: { in: [...wanted] } },
        select: { slug: true, value: true, pos: true, stem: true, corpusFrequencyPerMln: true },
    })
    const byslug = new Map(lexemes.map((l) => [l.slug, l]))

    console.log(`\nДокументов: ${docs.length}, словных токенов проанализировано: ${tokensSeen.toLocaleString("ru")}`)
    console.log(`Конкурирующих пар лексем: ${ranked.length.toLocaleString("ru")}\n`)
    console.log(`${"токенов".padStart(8)}  ${"класс".padEnd(26)}  пара`)

    for (const p of ranked.slice(0, 40)) {
        const la = byslug.get(p.a)
        const lb = byslug.get(p.b)
        const sameValue = la?.value && lb?.value && la.value.toLowerCase() === lb.value.toLowerCase()
        const samePos = la?.pos && lb?.pos && la.pos.toUpperCase() === lb.pos.toUpperCase()
        const crossGen = slugGeneration(p.a) !== slugGeneration(p.b)
        const cls = sameValue && samePos ? "ДУБЛЬ (значение+POS)"
            : sameValue ? "то же значение, др. POS"
            : crossGen ? "разные поколения слагов"
            : "разные слова"
        console.log(
            `${String(p.tokens).padStart(8)}  ${cls.padEnd(26)}  ` +
            `${p.a} (${la?.value ?? "?"}/${la?.pos ?? "?"}/стем=${la?.stem ?? "—"})  ×  ` +
            `${p.b} (${lb?.value ?? "?"}/${lb?.pos ?? "?"}/стем=${lb?.stem ?? "—"})`
        )
    }
}

main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => { void prismaCorpus.$disconnect(); void prismaData.$disconnect() })
