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

type Pair = { affix: string; lexeme: Word }

const reviewed = readFileSync("data/morpheme-review/2026-11-25-pass-29.json")
if (createHash("sha256").update(reviewed).digest("hex") !== "81b45dc31b4113e818abcd5ee5fa072023bd77d25b4644123bac8ca864e26c07") {
    throw new Error("The reviewed prefix pairs do not match this script version")
}
const { confirmed, rejected } = JSON.parse(reviewed.toString("utf8")) as {
    confirmed: (Pair & { base: Word })[]
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
    const russian = db.prepare<[number], { value: string | null }>(`
        SELECT DISTINCT t.value FROM translations t JOIN meanings m ON m.id = t.meaningId
        WHERE m.lexemeId = ? AND t.language = 'ru' ORDER BY t.value
    `).pluck()
    const checkWord = (expected: Word) => {
        const actual = word.get(expected.id)
        if (!actual || actual.value !== expected.value || actual.slug !== expected.slug ||
            actual.pos !== expected.pos || actual.stem !== expected.stem ||
            JSON.stringify(russian.all(expected.id)) !== JSON.stringify(expected.ru)) {
            throw new Error(`Reviewed lexeme #${expected.id} ${expected.value} changed`)
        }
    }

    const prefixes = new Map<string, number>()
    const find = db.prepare<[string], { id: number }>("SELECT id FROM morphemes WHERE type = 1 AND value = ?")
    const originalIds = { pre: 1717, od: 1723, pod: 1725, nad: 1726, za: 1728, iz: 1729 }
    const prefixNames = [...Object.keys(originalIds), "po", "pro", "raz"]
    const now = new Date().toISOString()
    const audit = db.prepare(`
        INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userEmail)
        VALUES (?, ?, ?, ?, ?, ?, 'script:review-morpheme-affixes-29')
    `)
    let createdPrefixes = 0
    for (const prefix of prefixNames) {
        const rows = find.all(prefix)
        if (rows.length > 1) throw new Error(`Ambiguous prefix: ${prefix}`)
        const [record] = rows
        if (prefix in originalIds && record?.id !== originalIds[prefix as keyof typeof originalIds]) {
            throw new Error(`Existing prefix ${prefix} changed`)
        }
        if (record) {
            prefixes.set(prefix, record.id)
            continue
        }
        createdPrefixes++
        console.log(`New prefix ${prefix}-`)
        const id = apply
            ? Number(db.prepare("INSERT INTO morphemes (value, type, updatedAt) VALUES (?, 1, ?)").run(prefix, now).lastInsertRowid)
            : -createdPrefixes
        prefixes.set(prefix, id)
        if (apply) {
            db.prepare("INSERT INTO morpheme_allophones (morphemeId, flavorId, value) VALUES (?, ?, ?)").run(id, core.id, prefix)
            const action = randomUUID()
            audit.run(action, "Morpheme", id, "value", null, prefix)
            audit.run(action, "Morpheme", id, "type", null, "1")
            audit.run(action, "Morpheme", id, "CORE", null, prefix)
        }
    }

    const readLinks = db.prepare<[number], number>(`
        SELECT DISTINCT morphemeId FROM lexemes_morphemes
        WHERE lexemeId = ? AND morphemeId IS NOT NULL ORDER BY morphemeId
    `).pluck()
    const link = db.prepare("INSERT INTO lexemes_morphemes (lexemeId, morphemeId) VALUES (?, ?)")
    const touch = db.prepare("UPDATE lexemes SET updatedAt = ? WHERE id = ?")
    const additions = new Map<number, Set<number>>()
    const prefixId = (affix: string) => {
        const id = prefixes.get(affix)
        if (id === undefined) throw new Error(`Unexpected reviewed prefix: ${affix}`)
        return id
    }
    for (const pair of confirmed) {
        checkWord(pair.lexeme)
        checkWord(pair.base)
        const ids = additions.get(pair.lexeme.id) ?? new Set<number>()
        ids.add(prefixId(pair.affix))
        additions.set(pair.lexeme.id, ids)
    }
    for (const pair of rejected) {
        checkWord(pair.lexeme)
        const id = prefixId(pair.affix)
        if (readLinks.all(pair.lexeme.id).includes(id) || additions.get(pair.lexeme.id)?.has(id)) {
            throw new Error(`Rejected prefix link found: #${pair.lexeme.id} / ${pair.affix}`)
        }
    }
    let addedLinks = 0
    for (const [lexemeId, requested] of additions) {
        const before = readLinks.all(lexemeId)
        const added = [...requested].filter((id) => !before.includes(id))
        addedLinks += added.length
        if (!apply || added.length === 0) continue
        for (const morphemeId of added) link.run(lexemeId, morphemeId)
        touch.run(now, lexemeId)
        const after = [...before, ...added].sort((a, b) => a - b)
        audit.run(randomUUID(), "Lexeme", lexemeId, "morphemeIds", JSON.stringify(before), JSON.stringify(after))
    }
    console.log(JSON.stringify({ apply, createdPrefixes, additions: addedLinks, rejected: rejected.length }))
}

try {
    const transaction = db.transaction(review)
    if (apply) transaction.immediate()
    else transaction.deferred()
} finally {
    db.close()
}
