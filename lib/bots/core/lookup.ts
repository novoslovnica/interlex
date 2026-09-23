import type Database from "better-sqlite3"
import { init } from "@/lib/sqlite"
import { levenshtein } from "@/lib/levenshtein"
import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"
import { cyrillicToLatin, isCyrillicText } from "@/lib/orthography/standard"
import { canonicalFromStem } from "@/lib/grammar/common/stem"
import { getAnalyzerIfReady } from "./analyzer"

export interface LookupEntry {
    id: number
    slug: string
    /** Написание для показа: value часто без диакритики ("clovek"), стем - с ней. */
    value: string
    pos: string | null
    gender: string | null
    aspect: string | null
    /** Переводы по языкам в порядке запроса: язык -> варианты (проверенные первыми). */
    translations: { language: string; values: string[] }[]
    /** Определения из meanings (межславянские), до двух. */
    meanings: string[]
    /** Пример употребления из первого значения. */
    example?: string
}

// meanings.meaning хранит "определение;лемма.;*пример*" в разном порядке
// ("člověk;ziva razumna bytosť...;*Tuten stary **člověk**...*").
export function splitMeaning(raw: string, lemma: string): { definition: string | null; example: string | null } {
    const folded = foldDiacritics(lemma.toLowerCase())
    const parts = raw.split(";").map((p) => p.trim()).filter(Boolean)
    const strip = (t: string) => t.replace(/\*\*/g, "").replace(/^\*|\*$/g, "").trim()
    const example = parts.find((p) => p.startsWith("*"))
    const definition = parts.find((p) => !p.startsWith("*") && foldDiacritics(p.replace(/\.$/, "").toLowerCase()) !== folded)
    return { definition: definition ?? null, example: example ? strip(example) : null }
}

export interface LookupResult {
    query: string
    /** Запрос, приведённый к латинице. */
    latinQuery: string
    entries: LookupEntry[]
    /** Как найдено: форма слова (анализатор), точное написание или похожие слова. */
    via: "form" | "exact" | "fuzzy" | "none"
    /** Грамматика найденной формы, если это форма, а не лемма ("vodu" -> "acc sg"). */
    formReadings?: string[]
}

const MAX_ENTRIES = 5

function loadEntries(db: Database.Database, ids: number[], languages: string[]): LookupEntry[] {
    if (ids.length === 0) return []
    const ph = ids.map(() => "?").join(",")
    const rows = db.prepare(`
        SELECT id, slug, value, stem, pos, gender, aspect FROM lexemes WHERE id IN (${ph}) AND isPublic = 1
    `).all(...ids) as { id: number; slug: string; value: string; stem: string | null; pos: string | null; gender: string | null; aspect: string | null }[]
    const byId = new Map(rows.map((r) => [r.id, r]))
    const langPh = languages.map(() => "?").join(",")
    const translations = languages.length === 0 ? [] : db.prepare(`
        SELECT m.lexemeId, t.language, t.value, t.verified FROM translations t
        JOIN meanings m ON m.id = t.meaningId
        WHERE m.lexemeId IN (${ph}) AND t.language IN (${langPh}) AND t.value IS NOT NULL AND t.value != ''
        ORDER BY m.id, t.verified DESC
    `).all(...ids, ...languages) as { lexemeId: number; language: string; value: string }[]
    const meanings = db.prepare(`
        SELECT lexemeId, meaning FROM meanings WHERE lexemeId IN (${ph}) AND meaning IS NOT NULL AND meaning != '' ORDER BY id
    `).all(...ids) as { lexemeId: number; meaning: string }[]

    return ids.flatMap((id) => {
        const row = byId.get(id)
        if (!row) return []
        const perLang = languages.map((language) => {
            const values: string[] = []
            for (const t of translations) {
                if (t.lexemeId !== id || t.language !== language) continue
                for (const v of t.value.split(/\s*[,;]\s*/)) if (v && !values.includes(v)) values.push(v)
            }
            return { language, values: values.slice(0, 6) }
        }).filter((t) => t.values.length > 0)
        const value = canonicalFromStem(row.value, row.stem) || row.value
        const split = meanings.filter((m) => m.lexemeId === id).slice(0, 2).map((m) => splitMeaning(m.meaning, value))
        return [{
            id: row.id, slug: row.slug, value, pos: row.pos, gender: row.gender, aspect: row.aspect,
            translations: perLang,
            meanings: split.map((m) => m.definition).filter((d): d is string => !!d),
            example: split.find((m) => m.example)?.example ?? undefined,
        }]
    })
}

function slugsToIds(db: Database.Database, slugs: string[]): number[] {
    if (slugs.length === 0) return []
    const rows = db.prepare(`SELECT id, slug FROM lexemes WHERE slug IN (${slugs.map(() => "?").join(",")})`).all(...slugs) as { id: number; slug: string }[]
    const bySlug = new Map(rows.map((r) => [r.slug, r.id]))
    return slugs.map((s) => bySlug.get(s)).filter((id): id is number => id !== undefined)
}

// Написания всех публичных лексем без диакритики - для точного поиска
// ("človek" = "člověk", "clovek") и опечаток. FTS5-индекс сайта (trigram) ищет
// только подстроки с диакритикой, поэтому здесь не подходит. ~21 тыс. строк,
// держится в памяти и перечитывается раз в 10 минут, чтобы видеть правки словаря.
const INDEX_TTL_MS = 10 * 60 * 1000
let foldedIndex: { key: string; at: number; entries: { id: number; variants: string[] }[] } | null = null

export function resetLookupIndex(): void {
    foldedIndex = null
}

function getFoldedIndex(db: Database.Database) {
    if (foldedIndex && foldedIndex.key === db.name && Date.now() - foldedIndex.at < INDEX_TTL_MS) return foldedIndex.entries
    const rows = db.prepare(`SELECT id, value FROM lexemes WHERE isPublic = 1 AND value IS NOT NULL AND value != ''`).all() as { id: number; value: string }[]
    const entries = rows.map((r) => ({
        id: r.id,
        // У лексемы может быть несколько вариантов через запятую ("tak, tako").
        variants: r.value.split(/\s*,\s*/).filter(Boolean).map((v) => foldDiacritics(v.toLowerCase())),
    }))
    foldedIndex = { key: db.name, at: Date.now(), entries }
    return entries
}

function searchDictionary(db: Database.Database, latin: string): { ids: number[]; exact: boolean } {
    const folded = foldDiacritics(latin.toLowerCase())
    const entries = getFoldedIndex(db)
    const exact = entries.filter((e) => e.variants.includes(folded)).map((e) => e.id)
    if (exact.length > 0) return { ids: exact, exact: true }

    // Опечатка или начало слова: расстояние не больше трети длины запроса.
    const maxDistance = Math.max(1, Math.floor(folded.length / 3))
    const scored: { id: number; distance: number; prefix: boolean }[] = []
    for (const e of entries) {
        let best = Infinity
        let prefix = false
        for (const v of e.variants) {
            if (v.startsWith(folded) && folded.length >= 3) prefix = true
            if (Math.abs(v.length - folded.length) > maxDistance) continue
            best = Math.min(best, levenshtein(v, folded))
        }
        if (best <= maxDistance || prefix) scored.push({ id: e.id, distance: prefix ? Math.min(best, maxDistance) : best, prefix })
    }
    scored.sort((a, b) => a.distance - b.distance || Number(b.prefix) - Number(a.prefix) || a.id - b.id)
    return { ids: scored.map((s) => s.id), exact: false }
}

/** Минимум анализатора, который нужен поиску (DbAnalyzer; в тестах - заглушка). */
export interface FormAnalyzer {
    analyzeWord(surfaceForm: string): Promise<{ wordSlug: string | null; isPartialMatch?: boolean; feats?: object; candidates?: { wordSlug: string; feats?: object }[] } | null>
}

export async function lookupInDb(db: Database.Database, query: string, languages: string[], analyzer: FormAnalyzer | null): Promise<LookupResult> {
    const trimmed = query.trim().replace(/\s+/g, " ").slice(0, 80)
    const latinQuery = isCyrillicText(trimmed) ? cyrillicToLatin(trimmed) : trimmed
    const empty: LookupResult = { query: trimmed, latinQuery, entries: [], via: "none" }
    if (!latinQuery) return empty

    // Форма слова ("vodu", "pišeš") - через анализатор корпуса, если он уже собран.
    if (analyzer && !latinQuery.includes(" ")) {
        const analysis = await analyzer.analyzeWord(latinQuery)
        if (analysis && !analysis.isPartialMatch) {
            const slugs = [...new Set([analysis.wordSlug, ...(analysis.candidates ?? []).map((c) => c.wordSlug)].filter((s): s is string => !!s))]
            const entries = loadEntries(db, slugsToIds(db, slugs).slice(0, MAX_ENTRIES), languages)
            if (entries.length > 0) {
                // Все прочтения формы у найденного слова ("vodu" - вин. ед. и род./мест. дв.);
                // род и одушевлённость существительного - свойство слова, не формы.
                const readings = [analysis, ...(analysis.candidates ?? [])]
                    .filter((c) => c.wordSlug === entries[0].slug)
                    .map((c) => Object.entries(c.feats ?? {}).filter(([k, v]) => typeof v === "string" && k !== "gender" && k !== "animacy").map(([, v]) => v).join(" "))
                    .filter(Boolean)
                return { query: trimmed, latinQuery, entries, via: "form", formReadings: [...new Set(readings)].slice(0, 3) }
            }
        }
    }
    const { ids, exact } = searchDictionary(db, latinQuery)
    const entries = loadEntries(db, ids.slice(0, MAX_ENTRIES), languages)
    return entries.length ? { query: trimmed, latinQuery, entries, via: exact ? "exact" : "fuzzy" } : empty
}

export async function lookupWord(query: string, languages: string[]): Promise<LookupResult> {
    const db = await init()
    try {
        return await lookupInDb(db, query, languages, getAnalyzerIfReady())
    } finally {
        db.close()
    }
}

export async function loadEntryById(id: number, languages: string[]): Promise<LookupEntry | null> {
    const db = await init()
    try { return loadEntries(db, [id], languages)[0] ?? null } finally { db.close() }
}

/** Одна лексема по id - для команд, которым нужна полная строка (парадигма). */
export async function loadLexemeRow(id: number): Promise<Record<string, unknown> | null> {
    const db = await init()
    try {
        const row = db.prepare(`SELECT * FROM lexemes WHERE id = ? AND isPublic = 1`).get(id) as Record<string, unknown> | undefined
        if (!row) return null
        const roots = db.prepare(`
            SELECT m.value, m.stressPosition FROM morphemes m
            WHERE m.id IN (SELECT morphemeId FROM lexemes_morphemes WHERE lexemeId = ?)
        `).all(id)
        const core = db.prepare(`
            SELECT la.value FROM lexeme_allophones la JOIN allophone_flavors af ON af.id = la.flavorId
            WHERE la.lexemeId = ? AND af.code = 'CORE' AND la.type = 'standard' LIMIT 1
        `).get(id) as { value: string } | undefined
        return { ...row, roots, word: core ? { value: core.value } : null }
    } finally {
        db.close()
    }
}
