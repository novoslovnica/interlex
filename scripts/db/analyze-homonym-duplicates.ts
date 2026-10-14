// Отчёт «какие дубликаты словаря реально мешают разметке корпуса» — вход в
// дедупликацию (roadmap п.111 → п.113) по реальной нагрузке, а не по алфавиту.
//
// Классификация пар живёт в чистом lib/corpus/homonymDuplicates.ts — тот же
// модуль использует страница /admin/corpus/homonym-duplicates. Здесь только
// чтение данных (better-sqlite3, без Prisma) и печать, поэтому копий логики нет.
//
// Скрипт НИЧЕГО не сливает и не пишет — только читает и печатает. Решение о
// слиянии принимает модератор в /admin/deduplication (AGENTS.md: не
// фабриковать лингвистический факт).
//
// Reads corpus.db (группы) и interlex.db (метаданные лексем); пути берутся из
// CORPUS_SQLITE_DB и SQLITE_DB (их ставит раннер реестра), с фолбэком на корень
// репозитория.
//
// Usage:
//   npx tsx scripts/db/analyze-homonym-duplicates.ts [--limit=40] [--min-tokens=1] [--json]
//   npx tsx scripts/db/analyze-homonym-duplicates.ts --out=dups.json

import Database from "better-sqlite3"
import { writeFileSync } from "fs"
import path from "path"
import { parseHomonymGroupKey } from "@/lib/corpus/homonymGroup"
import {
    aggregateDuplicatePairs,
    assembleHomonymDuplicates,
    summarizeHomonymDuplicates,
    DUPLICATE_TRAP_EXAMPLES,
    type DuplicatePairAgg,
    type LexemeMeta,
} from "@/lib/corpus/homonymDuplicates"

const CORPUS_DB = process.env.CORPUS_SQLITE_DB || path.resolve(process.cwd(), "corpus.db")
const DATA_DB = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")

function argValue(name: string): string | undefined {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
    return hit ? hit.slice(name.length + 3) : undefined
}
const limit = Number(argValue("limit") ?? 40)
const minTokens = Number(argValue("min-tokens") ?? 1)
const asJson = process.argv.includes("--json")
const outFile = argValue("out")

function loadLexemes(slugs: string[]): Map<string, LexemeMeta> {
    const data = new Database(DATA_DB, { readonly: true })
    const out = new Map<string, LexemeMeta>()
    const CHUNK = 400
    const COLUMNS = "SELECT slug,value,pos,gender,animacy,stem,paradigm,corpusFrequencyPerMln FROM lexemes WHERE slug IN ("
    for (let i = 0; i < slugs.length; i += CHUNK) {
        const chunk = slugs.slice(i, i + CHUNK)
        const marks = chunk.map(() => "?").join(",")
        for (const r of data.prepare(COLUMNS + marks + ")").all(...chunk) as LexemeMeta[]) out.set(r.slug, r)
    }
    data.close()
    return out
}

function main() {
    const corpus = new Database(CORPUS_DB, { readonly: true })
    const groups = corpus.prepare(`
        SELECT "homonymGroupKey" AS groupKey, COUNT(*) AS tokenCount,
               COUNT(DISTINCT "documentSlug") AS documentCount
        FROM "CorpusToken"
        WHERE "homonymGroupKey" IS NOT NULL
        GROUP BY "homonymGroupKey"
    `).all() as { groupKey: string; tokenCount: number; documentCount: number }[]
    corpus.close()

    const slugs = new Set<string>()
    for (const g of groups) {
        for (const s of parseHomonymGroupKey(g.groupKey)?.wordSlugs ?? []) slugs.add(s)
    }
    const lexemes = loadLexemes([...slugs])

    const result = assembleHomonymDuplicates(groups, lexemes)
    const totals = summarizeHomonymDuplicates(result)
    const pairs = aggregateDuplicatePairs(result)

    if (outFile) {
        writeFileSync(outFile, JSON.stringify({ totals, pairs, groups: result }, null, 1))
        console.log(`${pairs.length} пар -> ${outFile}`)
        if (!asJson) return
    }
    if (asJson) {
        console.log(JSON.stringify({ totals, pairs: pairs.slice(0, limit) }, null, 1))
        return
    }

    const safePairs = pairs.filter((p) => p.pair.safe)
    console.log(`Групп омонимии с признаками дублей: ${totals.flaggedGroups} из ${groups.length}`)
    console.log(`Токенов в них: ${totals.tokensInFlagged}`)
    console.log(`Уникальных пар лексем: ${totals.distinctPairs}`
        + ` (из них ${totals.distinctLegacyPairs} со слагом старого формата, ${totals.distinctSafePairs} безопасных)`)
    console.log(`Пар, где один слаг старого формата: ${totals.pairsWithLegacy}`)
    for (const [kind, v] of Object.entries(totals.kind)) {
        console.log(`  ${kind}: ${v.groups} групп, ${v.pairs} пар, ${v.tokens} токенов`)
    }
    console.log(`Безопасных к слиянию (identical-value + основа и род буквально равны):`
        + ` ${totals.safe.groups} групп, ${totals.safe.pairs} пар, ${totals.safe.tokens} токенов`)
    console.log("\nИзвестные ловушки (НЕ дубли, хотя похожи):")
    for (const e of DUPLICATE_TRAP_EXAMPLES) console.log(`  · ${e}`)

    const print = (list: DuplicatePairAgg[], title: string) => {
        const shown = list.filter((p) => p.maxTokens >= minTokens).slice(0, limit)
        console.log(`\n=== ${title}: ${list.length} пар (показано ${shown.length}) ===`)
        for (const p of shown) {
            const x = p.pair
            const legacy = x.legacySlug ?? "-"
            const other = x.legacySlug ? x.otherSlug : `${x.a} / ${x.b}`
            console.log(`${String(p.maxTokens).padStart(6)} tok | ${x.kind.padEnd(17)}`
                + ` | legacy=${legacy.padEnd(18)} -> ${other.padEnd(20)}`
                + ` | групп=${p.groups} форм=${p.forms.slice(0, 3).join(",")}`)
        }
    }
    print(safePairs, "БЕЗОПАСНО СЛИТЬ")
    print(pairs.filter((p) => !p.pair.safe), "ГИПОТЕЗЫ — ПРОВЕРИТЬ ГЛАЗАМИ")
}

main()
