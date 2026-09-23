import { createHash } from "crypto"
import type Database from "better-sqlite3"
import { init } from "@/lib/sqlite"

// Слово дня: одно и то же для всех в течение суток (UTC), без хранения - индекс
// в пуле выводится из хэша даты. Пул - знаменательные слова уровней A1-B2 с
// проверенным переводом на en или ru (~5,9 тыс. на 2026-09-24), чтобы слово
// было полезным и перевод - надёжным.

// IN (подзапрос) вместо EXISTS на каждую лексему: так SQLite идёт от
// проверенных переводов по индексу, 0,5 с вместо ~50 с.
const POOL_SQL = `
    SELECT l.id FROM lexemes l
    WHERE l.isPublic = 1 AND l.pos IN ('NOUN', 'VERB', 'ADJ', 'ADV')
      AND l.cefrLevel IN ('A1', 'A2', 'B1', 'B2')
      AND l.id IN (
        SELECT m.lexemeId FROM translations t JOIN meanings m ON m.id = t.meaningId
        WHERE t.language IN ('en', 'ru') AND t.verified = 1 AND t.value IS NOT NULL AND t.value != ''
      )
    ORDER BY l.id
`
export function dayKey(date: Date): string {
    return date.toISOString().slice(0, 10)
}

export function pickIndex(key: string, poolSize: number): number {
    const hash = createHash("sha256").update(`isv-word-of-day:${key}`).digest()
    return hash.readUInt32BE(0) % poolSize
}

let cache: { key: string; id: number } | null = null

export function wordOfDayId(db: Database.Database, date: Date): number | null {
    const key = dayKey(date)
    if (cache?.key === key) return cache.id
    const pool = db.prepare(POOL_SQL).all() as { id: number }[]
    if (pool.length === 0) return null
    const id = pool[pickIndex(key, pool.length)].id
    cache = { key, id }
    return id
}

export async function getWordOfDayId(date: Date = new Date()): Promise<number | null> {
    const db = await init()
    try { return wordOfDayId(db, date) } finally { db.close() }
}
