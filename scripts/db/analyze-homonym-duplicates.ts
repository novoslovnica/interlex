// Отчёт «какие дубликаты словаря реально мешают разметке корпуса» — вход в
// дедупликацию (roadmap п.113/п.111) по реальной нагрузке, а не по алфавиту.
//
// Зачем: из групп массовой разметки омонимов (lib/corpus/homonymGroup.ts)
// значительная часть — не омонимия, а дубликаты лексем (se/sej, slovo/slova…).
// Очередь подсказывает, ЧТО стоит слить в первую очередь: чем больше токенов
// у группы, тем больше разметки снимает одна дедупликация.
//
// Скрипт НИЧЕГО не сливает и не пишет — только читает и печатает. Решение о
// слиянии принимает модератор в /admin/deduplication (AGENTS.md: не
// фабриковать лингвистический факт). Здесь только два объективных признака:
//   same-value-same-pos  — у двух лексем совпадают value+pos+род после свёртки
//                          диакритики: почти наверняка один и тот же дубль;
//   same-value-diff-gender — value+pos совпадают, род разный: проверить.
// Совпадающий стем признаком НЕ считается: у настоящих омонимов
// (ne-ADV/ne-INTJ) он тоже совпадает.
//
// Reads corpus.db (группы) и interlex.db (метаданные лексем) напрямую через
// better-sqlite3 — без Prisma и без dotenv: пути берутся из CORPUS_SQLITE_DB и
// SQLITE_DB (их ставит раннер реестра), с фолбэком на корень репозитория.
//
// Usage:
//   npx tsx scripts/db/analyze-homonym-duplicates.ts [--limit=40] [--min-tokens=1] [--json]
//   npx tsx scripts/db/analyze-homonym-duplicates.ts --limit=100 --out=dups.json

import Database from "better-sqlite3"
import { writeFileSync } from "fs"
import path from "path"
import { parseHomonymGroupKey } from "@/lib/corpus/homonymGroup"
import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"

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

interface LexemeRow {
    slug: string
    value: string | null
    pos: string | null
    gender: string | null
    animacy: string | null
    stem: string | null
    paradigm: string | null
    protoStemClass: string | null
    isCollocation: number | null
    corpusFrequency: number | null
    corpusFrequencyPerMln: number | null
}

interface FlaggedPair {
    /**
     * legacy-lowercase-pos — один из слагов старого формата (POS строчными:
     *   drugy-adj, pred-n, či-conj). Это ровно тот класс, что остался открытым
     *   в docs/history/2026-09-15-duplicate-service-lexemes.md («529 more legacy
     *   lowercase-POS lexemes … have not been reviewed»).
     * spelling-variant — оба слага в новом формате, value совпадает после
     *   свёртки диакритики, но различается как написано (треба/treba).
     * identical — оба в новом формате и value совпадает буквально.
     */
    kind: "legacy-lowercase-pos" | "spelling-variant" | "identical"
    a: string
    b: string
    genderMismatch: boolean
}

interface FlaggedGroup {
    form: string
    groupKey: string
    tokenCount: number
    documentCount: number
    pairs: FlaggedPair[]
    lexemes: LexemeRow[]
}

function main() {
    const corpus = new Database(CORPUS_DB, { readonly: true })
    const data = new Database(DATA_DB, { readonly: true })

    // Считаем по группам только ключ и нагрузку — индекс покрывающий.
    const groups = corpus.prepare(`
        SELECT "homonymGroupKey" AS k, COUNT(*) AS tokens, COUNT(DISTINCT "documentSlug") AS docs
        FROM "CorpusToken"
        WHERE "homonymGroupKey" IS NOT NULL
        GROUP BY "homonymGroupKey"
        ORDER BY tokens DESC
    `).all() as { k: string; tokens: number; docs: number }[]

    const allSlugs = new Set<string>()
    const parsedGroups = groups.map((g) => {
        const parsed = parseHomonymGroupKey(g.k)
        if (parsed) for (const s of parsed.wordSlugs) allSlugs.add(s)
        return { g, parsed }
    })

    const slugs = [...allSlugs]
    const lexemes = new Map<string, LexemeRow>()
    const CHUNK = 400
    for (let i = 0; i < slugs.length; i += CHUNK) {
        const chunk = slugs.slice(i, i + CHUNK)
        const marks = chunk.map(() => "?").join(",")
        const sql = "SELECT slug,value,pos,gender,animacy,stem,paradigm,protoStemClass,isCollocation,"
            + "corpusFrequency,corpusFrequencyPerMln FROM lexemes WHERE slug IN (" + marks + ")"
        for (const r of data.prepare(sql).all(...chunk) as LexemeRow[]) lexemes.set(r.slug, r)
    }

    const folded = (v: string | null) => (v ? foldDiacritics(v.toLowerCase()) : "")

    // POS — последний сегмент слага (value может содержать дефисы и запятые:
    // "imeti, imati-VERB"). Старый формат писал POS строчными ("drugy-adj").
    const posOf = (slug: string) => {
        const i = slug.lastIndexOf("-")
        return i < 0 ? "" : slug.slice(i + 1)
    }
    const isLegacyPos = (slug: string) => {
        const p = posOf(slug)
        return p.length > 0 && p === p.toLowerCase() && p !== p.toUpperCase()
    }

    const KINDS = ["legacy-lowercase-pos", "spelling-variant", "identical"] as const
    const flagged: FlaggedGroup[] = []
    let tokensInFlagged = 0
    const kindPairs: Record<string, number> = { "legacy-lowercase-pos": 0, "spelling-variant": 0, "identical": 0 }
    const kindGroups: Record<string, number> = { "legacy-lowercase-pos": 0, "spelling-variant": 0, "identical": 0 }
    const kindTokens: Record<string, number> = { "legacy-lowercase-pos": 0, "spelling-variant": 0, "identical": 0 }

    for (const { g, parsed } of parsedGroups) {
        if (!parsed) continue
        const ls = parsed.wordSlugs.map((s) => lexemes.get(s)).filter(Boolean) as LexemeRow[]
        const pairs: FlaggedPair[] = []
        for (let i = 0; i < ls.length; i++) {
            for (let j = i + 1; j < ls.length; j++) {
                const a = ls[i]
                const b = ls[j]
                if (!a.value || !b.value) continue
                if (a.pos !== b.pos) continue
                if (folded(a.value) !== folded(b.value)) continue
                const legacy = isLegacyPos(a.slug) !== isLegacyPos(b.slug)
                const kind: FlaggedPair["kind"] = legacy
                    ? "legacy-lowercase-pos"
                    : (a.value !== b.value ? "spelling-variant" : "identical")
                pairs.push({
                    kind,
                    a: a.slug,
                    b: b.slug,
                    genderMismatch: (a.gender ?? null) !== (b.gender ?? null),
                })
            }
        }
        if (pairs.length === 0) continue
        // Сводка считается по ВСЕМ найденным группам, независимо от --min-tokens
        // (тот фильтрует только печать), иначе --min-tokens молча занижал бы итог.
        tokensInFlagged += g.tokens
        for (const kind of new Set(pairs.map((p) => p.kind))) {
            kindGroups[kind]++
            kindTokens[kind] += g.tokens
        }
        for (const p of pairs) kindPairs[p.kind]++
        flagged.push({
            form: parsed.form,
            groupKey: g.k,
            tokenCount: g.tokens,
            documentCount: g.docs,
            pairs,
            lexemes: ls,
        })
    }

    const fmtLexeme = (l: LexemeRow) =>
        `${l.slug}${isLegacyPos(l.slug) ? " [legacy-pos]" : ""} | value=${l.value} pos=${l.pos} `
        + `род=${l.gender ?? "-"} основа=${l.stem ?? "-"} парадигма=${l.paradigm ?? "-"} `
        + `част/млн=${l.corpusFrequencyPerMln ?? "-"}`

    const totals = { groups: flagged.length, tokens: tokensInFlagged, kindPairs, kindGroups, kindTokens }
    if (outFile) {
        writeFileSync(outFile, JSON.stringify(flagged, null, 1))
        console.log(`${flagged.length} групп с признаками дублей -> ${outFile}`)
    }
    if (asJson) {
        console.log(JSON.stringify({ totals, flagged: flagged.slice(0, limit) }, null, 1))
        return
    }

    console.log(`Групп омонимии с признаками дублей: ${flagged.length} из ${groups.length}`)
    console.log(`Токенов в них: ${tokensInFlagged}\n`)
    for (const kind of KINDS) {
        console.log(`  ${kind}: ${kindGroups[kind]} групп, ${kindPairs[kind]} пар, ${kindTokens[kind]} токенов`)
    }
    // Один и тот же дубль встречается во многих группах форм (drugy-ADJ/drugy-adj
    // — в шести). Реальный список на ревью — уникальные пары лексем, а не группы.
    const distinctPairs = new Map<string, FlaggedPair>()
    const legacySlugs = new Set<string>()
    for (const grp of flagged) {
        for (const p of grp.pairs) {
            const id = [p.a, p.b].sort().join(" <=> ")
            if (!distinctPairs.has(id)) distinctPairs.set(id, p)
            if (isLegacyPos(p.a)) legacySlugs.add(p.a)
            if (isLegacyPos(p.b)) legacySlugs.add(p.b)
        }
    }
    console.log(`\nУникальных пар лексем на ревью: ${distinctPairs.size}`)
    console.log(`Легаси-лексем (старый формат слага) в них: ${legacySlugs.size}`)
    const listed = flagged.filter((f) => f.tokenCount >= minTokens)
    console.log(`\nТоп-${Math.min(limit, listed.length)} групп по нагрузке:\n`)
    for (const grp of listed.slice(0, limit)) {
        console.log(`${grp.form} — ${grp.tokenCount} токенов в ${grp.documentCount} док.`)
        for (const p of grp.pairs) {
            console.log(`   [${p.kind}${p.genderMismatch ? ", род разный" : ""}] ${p.a} <=> ${p.b}`)
        }
        for (const l of grp.lexemes) console.log(`   · ${fmtLexeme(l)}`)
        console.log("")
    }
    if (listed.length > limit) console.log(`… ещё ${listed.length - limit} групп (см. --limit)`)
}

main()
