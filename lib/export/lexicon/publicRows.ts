import type Database from "better-sqlite3"
import { TRANSLATION_LANGUAGE_CODES } from "@/lib/translations"

export interface PublicLexiconRow {
    lexemeId: number
    slug: string
    searchKey: string | null
    core: string | null
    pos: string | null
    meaningId: number | null
    meaning: string | null
    language: string | null
    translation: string | null
    verified: number | null
}

export function publicLexiconRows(db: Database.Database) {
    return db.prepare<string[], PublicLexiconRow>(`
        SELECT l.id AS lexemeId, l.slug, l.value AS searchKey, la.value AS core, l.pos,
            m.id AS meaningId, m.meaning, t.language, t.value AS translation, t.verified
        FROM lexemes l
        LEFT JOIN lexeme_allophones la ON la.lexemeId = l.id AND la.type = 'standard'
            AND la.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE')
        LEFT JOIN meanings m ON m.lexemeId = l.id
        LEFT JOIN translations t ON t.meaningId = m.id AND trim(t.value) <> ''
            AND t.language IN (${TRANSLATION_LANGUAGE_CODES.map(() => "?").join(",")})
        WHERE l.isPublic = 1
        ORDER BY l.id, m.id, t.id
    `).iterate(...TRANSLATION_LANGUAGE_CODES)
}
