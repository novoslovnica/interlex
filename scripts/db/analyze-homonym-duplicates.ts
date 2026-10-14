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
import { expandSpellingVariants } from "@/lib/corpus/tokenizer/spellingVariants"

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
     * Три уровня доверия — градация по тому, на что опирается совпадение:
     *  identical-value — value совпадает буквально (регистр слага и POS),
     *    т.е. это один и тот же формат записи дважды. Самый безопасный случай.
     *  confirmed-variant — value отличаются только на пары, подтверждённые
     *    мейнтейнером (u→ų, i→y, dž→đ; lib/corpus/tokenizer/spellingVariants.ts).
     *  folded-only — совпадает лишь после полной свёртки диакритики. ЭТО
     *    ГИПОТЕЗА: свёртка смешивает ž/z, č/c, š/s, ę/e, ȯ/o, и здесь же лежат
     *    ложные срабатывания (žębra «жабры» и zebra «зебра»; celo-NOUN со
     *    стемом «čel» «лоб» и cělo-n со стемом «cěl» «целое» — разные слова с
     *    одинаковым записанным value). Проверять глазами.
     */
    kind: "identical-value" | "confirmed-variant" | "folded-only"
    /** Один из слагов — старого формата (POS строчными: drugy-adj). */
    legacyPos: boolean
    /** Основы совпадают после свёртки — аргумент за дубль, но свёртка слепа к č/c. */
    sameStem: boolean
    /** Основы совпадают БУКВАЛЬНО. */
    stemEqRaw: boolean
    /**
     * Единственный действительно безопасный к слиянию случай: value совпадает
     * буквально, POS совпадает, основы совпадают буквально и род не расходится.
     * Всё остальное — гипотеза на ручную проверку.
     * Контрпример, который проходит «identical-value» и НЕ проходит это: celo-NOUN
     * (стем «čel», «лоб») и cělo-n (стем «cěl», «целое») — у обоих записанный
     * value «celo», но это разные слова.
     */
    safe: boolean
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

    // Совпадение только по подтверждённым парам написаний (u→ų, i→y, dž→đ):
    // именно это мейнтейнер согласовал как «одно и то же слово, упрощённая
    // запись». Никакой собственной свёртки «похожих» букв здесь нет намеренно
    // (см. AGENTS.md: не выдумывать факты).
    const expandsTo = (x: string | null, y: string | null) => {
        if (!x || !y) return false
        const lx = x.toLowerCase()
        const ly = y.toLowerCase()
        return expandSpellingVariants(lx).includes(ly) || expandSpellingVariants(ly).includes(lx)
    }

    const KINDS = ["identical-value", "confirmed-variant", "folded-only"] as const
    const flagged: FlaggedGroup[] = []
    let tokensInFlagged = 0
    let pairsWithLegacy = 0
    const kindPairs: Record<string, number> = { "identical-value": 0, "confirmed-variant": 0, "folded-only": 0 }
    const kindGroups: Record<string, number> = { "identical-value": 0, "confirmed-variant": 0, "folded-only": 0 }
    const kindTokens: Record<string, number> = { "identical-value": 0, "confirmed-variant": 0, "folded-only": 0 }

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
                const rawEq = a.value.toLowerCase() === b.value.toLowerCase()
                const variantEq = expandsTo(a.value, b.value)
                const foldedEq = folded(a.value) === folded(b.value)
                if (!rawEq && !variantEq && !foldedEq) continue
                const kind: FlaggedPair["kind"] = rawEq
                    ? "identical-value"
                    : (variantEq ? "confirmed-variant" : "folded-only")
                const legacyPos = isLegacyPos(a.slug) !== isLegacyPos(b.slug)
                if (legacyPos) pairsWithLegacy++
                const stemEqRaw = (a.stem ?? "") === (b.stem ?? "")
                const genderMismatch = (a.gender ?? null) !== (b.gender ?? null)
                const safe = kind === "identical-value" && stemEqRaw && !genderMismatch
                pairs.push({
                    kind,
                    legacyPos,
                    sameStem: folded(a.stem) === folded(b.stem),
                    stemEqRaw,
                    safe,
                    a: a.slug,
                    b: b.slug,
                    genderMismatch,
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

    const totals = { groups: flagged.length, tokens: tokensInFlagged, pairsWithLegacy, kindPairs, kindGroups, kindTokens }
    if (outFile) {
        writeFileSync(outFile, JSON.stringify(flagged, null, 1))
        console.log(`${flagged.length} групп с признаками дублей -> ${outFile}`)
    }
    if (asJson) {
        console.log(JSON.stringify({ totals, flagged: flagged.slice(0, limit) }, null, 1))
        return
    }

    console.log(`Групп омонимии с признаками дублей: ${flagged.length} из ${groups.length}`)
    console.log(`Токенов в них: ${tokensInFlagged}`)
    console.log(`Пар, где один слаг старого формата (POS строчными): ${pairsWithLegacy}\n`)
    for (const kind of KINDS) {
        console.log(`  ${kind}: ${kindGroups[kind]} групп, ${kindPairs[kind]} пар, ${kindTokens[kind]} токенов`)
    }
    const safePairs = flagged.flatMap((f) => f.pairs).filter((p) => p.safe).length
    const safeGroups = flagged.filter((f) => f.pairs.some((p) => p.safe)).length
    const safeTokens = flagged.filter((f) => f.pairs.some((p) => p.safe)).reduce((s, f) => s + f.tokenCount, 0)
    console.log(`\nБезопасных к слиянию (identical-value + основы равны буквально + род):`
        + ` ${safeGroups} групп, ${safePairs} пар, ${safeTokens} токенов`)
    console.log("\n  identical-value — value совпадает буквально; БЕЗОПАСНО только вместе со")
    console.log("    совпадающей буквально основой и родом (строка [SAFE] ниже).")
    console.log("  confirmed-variant / folded-only — ГИПОТЕЗЫ, проверять глазами: подтверждённые")
    console.log("    пары написаний (u→ų, i→y) — правило РАСПОЗНАВАНИЯ форм, а не утверждение, что две")
    console.log("    цитатные формы — одно слово. Контрпримеры из этого же списка: biti-VERB (бить)")
    console.log("    и byti-VERB (быть), viti-VERB (вить) и vyti-VERB (выть) — разные глаголы;")
    console.log("    žębra «жабры» и zebra «зебра»; celo-NOUN (стем «čel», лоб) и cělo-n (стем «cěl», целое).")
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
            const marks = [p.safe ? "SAFE" : "", p.legacyPos ? "legacy" : "", p.sameStem ? "основа совпадает" : "", p.genderMismatch ? "род разный" : ""]
                .filter(Boolean).join(", ")
            console.log(`   [${p.kind}${marks ? ", " + marks : ""}] ${p.a} <=> ${p.b}`)
        }
        for (const l of grp.lexemes) console.log(`   · ${fmtLexeme(l)}`)
        console.log("")
    }
    if (listed.length > limit) console.log(`… ещё ${listed.length - limit} групп (см. --limit)`)
}

main()
