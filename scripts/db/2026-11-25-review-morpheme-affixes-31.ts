import { createHash, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import Database from "better-sqlite3"

interface Word {
    id: number
    value: string
    slug: string
    pos: string
    stem: string | null
    ru: (string | null)[]
}

interface Pair {
    type: 1 | 2
    affix: string
    registryNames: string[]
    lexeme: Word
}

interface Confirmed extends Pair {
    registryValue: string
    base?: Word
}

const reviewed = readFileSync("data/morpheme-review/2026-11-25-pass-31.json")
if (createHash("sha256").update(reviewed).digest("hex") !== "22e24a6368113096972672b72685d039aad5ffb44c908088987073b0b1c84847") {
    throw new Error("The reviewed affix pairs do not match this script version")
}
const { confirmed, rejected } = JSON.parse(reviewed.toString("utf8")) as {
    confirmed: Confirmed[]
    rejected: Pair[]
}

const path = process.env.SQLITE_DB
if (!path) throw new Error("SQLITE_DB is required. Use npm run db:run.")
const apply = process.argv.includes("--apply")
const db = new Database(path, { readonly: !apply, fileMustExist: true })
db.pragma("foreign_keys = ON")
db.pragma("busy_timeout = 10000")

function review() {
    const core = db.prepare<[], { id: number }>("SELECT id FROM allophone_flavors WHERE code = 'CORE'").get()
    if (!core) throw new Error("Missing CORE flavor")
    const word = db.prepare<[number], Omit<Word, "ru">>(
        "SELECT id, value, slug, pos, stem FROM lexemes WHERE id = ? AND isPublic = 1",
    )
    const russian = db.prepare<[number], string | null>(`
        SELECT DISTINCT t.value FROM meanings m CROSS JOIN translations t ON t.meaningId = m.id
        WHERE m.lexemeId = ? AND t.language = 'ru' AND t.value IS NOT NULL ORDER BY t.value
    `).pluck()
    const checkWord = (expected: Word) => {
        const actual = word.get(expected.id)
        if (!actual || actual.value !== expected.value || actual.slug !== expected.slug ||
            actual.pos !== expected.pos || actual.stem !== expected.stem ||
            JSON.stringify(russian.all(expected.id)) !== JSON.stringify(expected.ru)) {
            throw new Error(`Reviewed lexeme #${expected.id} ${expected.value} changed`)
        }
    }

    const morphemes = db.prepare<[], { id: number; type: number; value: string | null }>(
        "SELECT id, type, value FROM morphemes WHERE type IN (1, 2)",
    ).all()
    const variants = db.prepare<[number], string>(`
        SELECT value FROM morpheme_allophones WHERE morphemeId = ?
    `).pluck()
    const registryKey = (value: string | null) => (value ?? "").normalize("NFC").trim().toLowerCase()
    const find = ({ type, registryNames }: Pair) => {
        const names = new Set(registryNames.map(registryKey))
        return morphemes.filter((record) => record.type === type && (
            names.has(registryKey(record.value)) ||
            variants.all(record.id).some((value) => names.has(registryKey(value)))
        ))
    }
    const now = new Date().toISOString()
    const audit = db.prepare(`
        INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userEmail)
        VALUES (?, ?, ?, ?, ?, ?, 'script:review-morpheme-affixes-31')
    `)
    const insertMorpheme = db.prepare("INSERT INTO morphemes (value, type, updatedAt) VALUES (?, ?, ?)")
    const insertCore = db.prepare("INSERT INTO morpheme_allophones (morphemeId, flavorId, value) VALUES (?, ?, ?)")
    const resolved = new Map<string, number>()
    let createdAffixes = 0
    const idFor = (pair: Confirmed) => {
        const { type, affix, registryValue } = pair
        const key = `${type}:${affix}:${registryValue}`
        const known = resolved.get(key)
        if (known !== undefined) return known
        const records = find(pair)
        if (records.length > 1 || (records[0] && records[0].value !== registryValue)) {
            throw new Error(`Unexpected registry records for ${key}`)
        }
        let id = records[0]?.id
        if (id === undefined) {
            createdAffixes++
            console.log(`New affix ${type}:${registryValue}`)
            id = apply ? Number(insertMorpheme.run(registryValue, type, now).lastInsertRowid) : -createdAffixes
            if (apply) {
                insertCore.run(id, core.id, registryValue)
                const action = randomUUID()
                audit.run(action, "Morpheme", id, "value", null, registryValue)
                audit.run(action, "Morpheme", id, "type", null, String(type))
                audit.run(action, "Morpheme", id, "CORE", null, registryValue)
            }
            morphemes.push({ id, type, value: registryValue })
        }
        resolved.set(key, id)
        return id
    }

    const readLinks = db.prepare<[number], number>(`
        SELECT DISTINCT morphemeId FROM lexemes_morphemes
        WHERE lexemeId = ? AND morphemeId IS NOT NULL ORDER BY morphemeId
    `).pluck()
    const link = db.prepare("INSERT INTO lexemes_morphemes (lexemeId, morphemeId) VALUES (?, ?)")
    const touch = db.prepare("UPDATE lexemes SET updatedAt = ? WHERE id = ?")
    const additions = new Map<number, Set<number>>()
    for (const pair of confirmed) {
        checkWord(pair.lexeme)
        if (pair.base) checkWord(pair.base)
        const ids = additions.get(pair.lexeme.id) ?? new Set<number>()
        ids.add(idFor(pair))
        additions.set(pair.lexeme.id, ids)
    }
    for (const pair of rejected) {
        checkWord(pair.lexeme)
        const existing = new Set(readLinks.all(pair.lexeme.id))
        const requested = additions.get(pair.lexeme.id)
        if (find(pair).some(({ id }) => existing.has(id) || requested?.has(id))) {
            throw new Error(`Rejected affix link found: #${pair.lexeme.id} / ${pair.type}:${pair.affix}`)
        }
    }

    let addedLinks = 0
    let editedLexemes = 0
    for (const [lexemeId, requested] of additions) {
        const before = readLinks.all(lexemeId)
        const added = [...requested].filter((id) => !before.includes(id))
        if (added.length === 0) continue
        addedLinks += added.length
        editedLexemes++
        if (!apply) continue
        for (const morphemeId of added) link.run(lexemeId, morphemeId)
        touch.run(now, lexemeId)
        const after = [...before, ...added].sort((a, b) => a - b)
        audit.run(randomUUID(), "Lexeme", lexemeId, "morphemeIds", JSON.stringify(before), JSON.stringify(after))
    }
    console.log(JSON.stringify({
        apply, createdAffixes, additions: addedLinks, editedLexemes,
        confirmed: confirmed.length, rejected: rejected.length,
    }))
}

try {
    const transaction = db.transaction(review)
    if (apply) transaction.immediate()
    else transaction.deferred()
} finally {
    db.close()
}
