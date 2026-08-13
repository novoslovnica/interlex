import { CqlParser } from "@/lib/cql/cqlParser"
import { CqlTranslator } from "@/lib/cql/cqlTranslator"
import { initCorpusDb } from "./corpusSqlite"

// Public KWIC search (roadmap #38). lib/cql/{cqlParser,cqlTranslator}.ts
// already existed but were never wired into a working route (see AGENTS.md/
// design notes - app/api/corpus/kwic/route_old.ts and route_test.ts are both
// stale/unregistered). This is the first real caller, so the guardrails
// CqlTranslator itself doesn't enforce (segment count, row limit) live here
// instead of inside the translator - it's a generic AST->SQL compiler, not
// specifically a public-facing one, and the admin/internal corpus tooling
// this was originally written for may reasonably want fewer restrictions.
export const MAX_CQL_SEGMENTS = 5
export const KWIC_DEFAULT_LIMIT = 25
export const KWIC_MAX_LIMIT = 50
export const CONTEXT_WINDOW = 10

export function clampKwicLimit(limit: number | null | undefined): number {
    if (limit == null || !Number.isFinite(limit) || limit <= 0) return KWIC_DEFAULT_LIMIT
    return Math.min(Math.floor(limit), KWIC_MAX_LIMIT)
}

export function clampKwicOffset(offset: number | null | undefined): number {
    if (offset == null || !Number.isFinite(offset) || offset < 0) return 0
    return Math.floor(offset)
}

export class CqlQueryError extends Error {}

export interface KwicToken {
    surfaceForm: string
    lemma: string
    pos: string
    feats: Record<string, unknown> | null
}

export interface KwicMatch {
    documentSlug: string
    documentTitle: string
    documentAuthor: string | null
    sentenceId: string
    sentenceText: string
    left: KwicToken[]
    match: KwicToken[]
    right: KwicToken[]
}

interface MatchRow {
    sentenceId: string
    documentSlug: string
    matchStart: number
    matchEnd: number
}

interface TokenRow {
    tokenIndex: number
    surfaceForm: string
    lemma: string
    pos: string
    feats: string | null
}

function parseFeats(raw: string | null): Record<string, unknown> | null {
    if (!raw) return null
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}

function toKwicToken(row: TokenRow): KwicToken {
    return { surfaceForm: row.surfaceForm, lemma: row.lemma, pos: row.pos, feats: parseFeats(row.feats) }
}

/**
 * documentSlug is applied as an outer filter over the translator's own
 * output rather than injected into the AST - keeps CqlTranslator's
 * contract (pure AST->SQL, no side inputs) unchanged.
 */
export function searchKwic(
    cqlQuery: string,
    limit: number,
    offset: number,
    documentSlug?: string,
): { items: KwicMatch[]; total: number } {
    let ast
    try {
        ast = CqlParser.parse(cqlQuery)
    } catch (e) {
        throw new CqlQueryError(e instanceof Error ? e.message : "Invalid CQL query.")
    }

    if (ast.segments.length > MAX_CQL_SEGMENTS) {
        throw new CqlQueryError(`Query has ${ast.segments.length} segments; the public API allows at most ${MAX_CQL_SEGMENTS}.`)
    }

    const { query, params } = CqlTranslator.toSQL(ast)

    const db = initCorpusDb()
    try {
        const filtered = documentSlug ? `SELECT * FROM (${query}) WHERE "documentSlug" = ?` : query
        const filteredParams = documentSlug ? [...params, documentSlug] : params

        const total = (
            db.prepare(`SELECT COUNT(*) c FROM (${filtered})`).get(...filteredParams) as { c: number }
        ).c

        const matchRows = db
            .prepare(`SELECT * FROM (${filtered}) LIMIT ? OFFSET ?`)
            .all(...filteredParams, limit, offset) as MatchRow[]

        if (matchRows.length === 0) return { items: [], total }

        const documentSlugs = [...new Set(matchRows.map((r) => r.documentSlug))]
        const docPlaceholders = documentSlugs.map(() => "?").join(",")
        const documents = db
            .prepare(`SELECT slug, title, author FROM "CorpusDocument" WHERE slug IN (${docPlaceholders})`)
            .all(...documentSlugs) as { slug: string; title: string; author: string | null }[]
        const documentBySlug = new Map(documents.map((d) => [d.slug, d]))

        const sentenceIds = [...new Set(matchRows.map((r) => r.sentenceId))]
        const sentPlaceholders = sentenceIds.map(() => "?").join(",")
        const sentences = db
            .prepare(`SELECT id, rawText FROM "CorpusSentence" WHERE id IN (${sentPlaceholders})`)
            .all(...sentenceIds) as { id: string; rawText: string }[]
        const sentenceById = new Map(sentences.map((s) => [s.id, s.rawText]))

        const tokenStmt = db.prepare(`
            SELECT "tokenIndex", "surfaceForm", lemma, pos, feats
            FROM "CorpusToken"
            WHERE "sentenceId" = ? AND "tokenIndex" BETWEEN ? AND ?
            ORDER BY "tokenIndex" ASC
        `)

        const items: KwicMatch[] = matchRows.map((row) => {
            const contextTokens = tokenStmt.all(
                row.sentenceId,
                row.matchStart - CONTEXT_WINDOW,
                row.matchEnd + CONTEXT_WINDOW,
            ) as TokenRow[]

            const left: KwicToken[] = []
            const match: KwicToken[] = []
            const right: KwicToken[] = []
            for (const t of contextTokens) {
                if (t.tokenIndex < row.matchStart) left.push(toKwicToken(t))
                else if (t.tokenIndex > row.matchEnd) right.push(toKwicToken(t))
                else match.push(toKwicToken(t))
            }

            const doc = documentBySlug.get(row.documentSlug)
            return {
                documentSlug: row.documentSlug,
                documentTitle: doc?.title ?? row.documentSlug,
                documentAuthor: doc?.author ?? null,
                sentenceId: row.sentenceId,
                sentenceText: sentenceById.get(row.sentenceId) ?? "",
                left,
                match,
                right,
            }
        })

        return { items, total }
    } finally {
        db.close()
    }
}
