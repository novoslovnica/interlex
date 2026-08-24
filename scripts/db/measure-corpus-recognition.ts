// Замер качества распознавания корпуса: сколько токенов зелёных/жёлтых/
// красных/омонимичных, какие красные формы самые частые и сколько из них
// в принципе достижимо словарём (симуляция стадии поиска лексемы, до
// сопоставления парадигмы).
//
// Читает БД напрямую через better-sqlite3, без Prisma — поэтому не требует
// -r dotenv/config (см. AGENTS.md, «Corpus Candidate Proposals», п.2 про
// tsx и hoisting импортов).
//
// Usage:
//   npx tsx scripts/db/measure-corpus-recognition.ts                 # отчёт
//   npx tsx scripts/db/measure-corpus-recognition.ts --json out.json # + снапшот
//   npx tsx scripts/db/measure-corpus-recognition.ts --compare before.json
//   npx tsx scripts/db/measure-corpus-recognition.ts --no-simulate   # только факт

import Database from "better-sqlite3"
import fs from "fs"
import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"
import { generateWestFlavor } from "@/lib/flavors"

const CORPUS_DB = process.env.CORPUS_SQLITE_DB || "corpus.db"
const DATA_DB = process.env.SQLITE_DB || "interlex.db"

const MAX_END_LEN = 4

type Buckets = { green: number; ambiguous: number; yellow: number; red: number; punct: number }

function readBuckets(corpus: Database.Database): Buckets {
    const rows = corpus.prepare(`
        SELECT CASE
                   WHEN wordIndex = -1 THEN 'punct'
                   WHEN matchCount = 0 THEN 'red'
                   WHEN isPartialMatch = 1 THEN 'yellow'
                   WHEN matchCount > 1 THEN 'ambiguous'
                   ELSE 'green'
               END AS k, COUNT(*) AS c
        FROM CorpusToken GROUP BY k
    `).all() as { k: keyof Buckets; c: number }[]
    const out: Buckets = { green: 0, ambiguous: 0, yellow: 0, red: 0, punct: 0 }
    for (const r of rows) out[r.k] = r.c
    return out
}

function pct(part: number, whole: number): string {
    return whole === 0 ? "—" : `${((part / whole) * 100).toFixed(1)}%`
}

function reportBuckets(b: Buckets): void {
    const words = b.green + b.ambiguous + b.yellow + b.red
    console.log(`\nТокенов всего: ${(words + b.punct).toLocaleString("ru")} (пунктуация: ${b.punct.toLocaleString("ru")})`)
    console.log(`Словных токенов: ${words.toLocaleString("ru")}`)
    for (const k of ["green", "ambiguous", "yellow", "red"] as const) {
        console.log(`  ${k.padEnd(10)} ${b[k].toLocaleString("ru").padStart(12)}  ${pct(b[k], words)}`)
    }
}

// Симуляция стадии 1 (найти лексему-кандидата), нарастающим итогом по
// «рычагам». Сопоставление парадигмы здесь не моделируется — это верхняя
// граница выигрыша, а не прогноз.
function simulate(corpus: Database.Database, data: Database.Database): void {
    const endings = new Set<string>(
        (data.prepare(`SELECT DISTINCT value FROM ending_allophones`).all() as { value: string }[])
            .map((r) => r.value.toLowerCase())
    )
    endings.add("")
    const foldedEndings = new Set<string>([...endings].map(foldDiacritics))

    // Текущий индекс: base_homonyms (стемы в CORE-написании).
    const currentBases = new Set<string>(
        (data.prepare(`SELECT base FROM base_homonyms`).all() as { base: string }[])
            .map((r) => r.base.toLowerCase())
    )

    // Рычаг 1: цитатная форма лексемы (Lexeme.value) как база — чинит
    // инфинитивы и всё, где value != stem.
    const values = (data.prepare(`SELECT value, stem FROM lexemes`).all() as { value: string | null; stem: string | null }[])
    const withValues = new Set(currentBases)
    for (const r of values) if (r.value) withValues.add(r.value.toLowerCase())

    // Рычаг 2: свёртка диакритики с обеих сторон.
    const foldedIndex = new Set<string>()
    for (const b of withValues) foldedIndex.add(foldDiacritics(b))

    // Рычаг 3: флейворные написания — значения lexeme_allophones (готовые
    // EAST/WEST/SOUTH/NSL формы) плюс западный флейвор стема, чтобы ловить
    // не только словарную форму, но и словоизменение.
    const withFlavors = new Set(foldedIndex)
    const allophones = data.prepare(`SELECT value FROM lexeme_allophones`).all() as { value: string | null }[]
    for (const r of allophones) if (r.value) withFlavors.add(foldDiacritics(r.value.toLowerCase()))
    for (const r of values) {
        const core = (r.stem || r.value || "").toLowerCase()
        if (core) withFlavors.add(foldDiacritics(generateWestFlavor(core)))
    }

    const reds = corpus.prepare(`
        SELECT lower(surfaceForm) AS sf, COUNT(*) AS c
        FROM CorpusToken WHERE matchCount = 0 AND wordIndex <> -1 GROUP BY 1
    `).all() as { sf: string; c: number }[]

    const reachable = (sf: string, index: Set<string>, endingSet: Set<string>, fold: boolean): boolean => {
        const probe = fold ? foldDiacritics(sf) : sf
        for (let endLen = 0; endLen <= MAX_END_LEN; endLen++) {
            const stemLen = probe.length - endLen
            if (stemLen < 1) continue
            if (stemLen < 2 && endLen > 0) continue
            const ending = probe.slice(stemLen)
            if (endLen !== 0 && !endingSet.has(ending)) continue
            if (index.has(probe.slice(0, stemLen))) return true
        }
        return false
    }

    const levers: Array<{ name: string; index: Set<string>; endings: Set<string>; fold: boolean }> = [
        { name: "сейчас (base_homonyms, CORE-стемы)", index: currentBases, endings, fold: false },
        { name: "+ цитатная форма лексемы как база", index: withValues, endings, fold: false },
        { name: "+ свёртка диакритики", index: foldedIndex, endings: foldedEndings, fold: true },
        { name: "+ флейворные написания", index: withFlavors, endings: foldedEndings, fold: true },
    ]

    const totalRedTokens = reds.reduce((s, r) => s + r.c, 0)
    console.log(`\nКрасных типов: ${reds.length.toLocaleString("ru")}, вхождений: ${totalRedTokens.toLocaleString("ru")}`)
    console.log(`Достижимо словарём (симуляция стадии поиска лексемы, нарастающим итогом):`)
    for (const lever of levers) {
        let types = 0
        let tokens = 0
        for (const r of reds) {
            if (reachable(r.sf, lever.index, lever.endings, lever.fold)) {
                types++
                tokens += r.c
            }
        }
        console.log(
            `  ${lever.name.padEnd(38)} типов ${types.toLocaleString("ru").padStart(8)}` +
            `  вхождений ${tokens.toLocaleString("ru").padStart(10)}  (${pct(tokens, totalRedTokens)} красных)`
        )
    }

    console.log(`\nТоп-15 красных форм:`)
    for (const r of reds.sort((a, b) => b.c - a.c).slice(0, 15)) {
        console.log(`  ${r.sf.padEnd(24)} ${r.c.toLocaleString("ru").padStart(8)}`)
    }
}

function main(): void {
    const argv = process.argv.slice(2)
    const jsonIdx = argv.indexOf("--json")
    const compareIdx = argv.indexOf("--compare")

    const corpus = new Database(CORPUS_DB, { readonly: true })
    const data = new Database(DATA_DB, { readonly: true })

    const buckets = readBuckets(corpus)
    reportBuckets(buckets)

    if (compareIdx !== -1) {
        const before = JSON.parse(fs.readFileSync(argv[compareIdx + 1], "utf8")) as Buckets
        console.log(`\nДельта к ${argv[compareIdx + 1]}:`)
        for (const k of ["green", "ambiguous", "yellow", "red"] as const) {
            const d = buckets[k] - before[k]
            console.log(`  ${k.padEnd(10)} ${d >= 0 ? "+" : ""}${d.toLocaleString("ru")}`)
        }
    }

    if (!argv.includes("--no-simulate")) simulate(corpus, data)

    if (jsonIdx !== -1) {
        fs.writeFileSync(argv[jsonIdx + 1], JSON.stringify(buckets, null, 2))
        console.log(`\nСнапшот записан: ${argv[jsonIdx + 1]}`)
    }

    corpus.close()
    data.close()
}

main()
