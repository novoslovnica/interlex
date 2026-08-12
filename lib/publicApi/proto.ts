import type Database from "better-sqlite3"
import { init } from "@/lib/sqlite"

// ProtoSlavicWord has no moderation/internal fields at all (confirmed
// against prisma/data.schema.prisma: id/lemma/body/sourceUrl only) - unlike
// lib/publicApi/words.ts's Lexeme, no allowlist reasoning is needed here.
// Don't assume the same is true for other models.
export interface PublicProtoWord {
    id: number
    lemma: string
    body: string
    sourceUrl: string
}

const PUBLIC_PROTO_COLUMNS = `id, lemma, body, source_url AS sourceUrl`

export async function searchPublicProtoWords(
    search: string,
    limit: number,
    offset: number,
): Promise<{ items: PublicProtoWord[]; total: number }> {
    const db: Database.Database = await init()

    if (search) {
        const like = `%${search}%`
        const total = (
            db.prepare(`SELECT COUNT(*) c FROM proto_slavic_words WHERE lemma LIKE ?`).get(like) as { c: number }
        ).c
        const items = db.prepare(`
            SELECT ${PUBLIC_PROTO_COLUMNS} FROM proto_slavic_words WHERE lemma LIKE ? ORDER BY lemma ASC LIMIT ? OFFSET ?
        `).all(like, limit, offset) as PublicProtoWord[]
        return { items, total }
    }

    const total = (db.prepare(`SELECT COUNT(*) c FROM proto_slavic_words`).get() as { c: number }).c
    const items = db.prepare(`
        SELECT ${PUBLIC_PROTO_COLUMNS} FROM proto_slavic_words ORDER BY lemma ASC LIMIT ? OFFSET ?
    `).all(limit, offset) as PublicProtoWord[]
    return { items, total }
}

export interface PublicProtoMorpheme {
    value: string | null
    meaning: string | null
}

export interface PublicProtoWordDetail extends PublicProtoWord {
    morphemes: PublicProtoMorpheme[]
}

export async function getPublicProtoWordById(id: number): Promise<PublicProtoWordDetail | null> {
    const db: Database.Database = await init()
    const word = db.prepare(`SELECT ${PUBLIC_PROTO_COLUMNS} FROM proto_slavic_words WHERE id = ?`).get(id) as
        | PublicProtoWord
        | undefined
    if (!word) return null

    const morphemes = db.prepare(`SELECT value, meaning FROM morphemes WHERE protoSlavicWordId = ?`).all(id) as PublicProtoMorpheme[]
    return { ...word, morphemes }
}
