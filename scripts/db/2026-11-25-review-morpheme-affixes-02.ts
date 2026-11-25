import { createHash, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import Database from "better-sqlite3"

interface Word {
    id: number
    slug: string
    value: string
    pos: string
    stem: string | null
    ru: (string | null)[]
}

interface Review {
    confirmed: { affix: string; lexeme: Word; base: Word; removeRootId?: 1718 }[]
    rejected: { affix: string; lexeme: Word; reason: string; remove: boolean }[]
}

const data = readFileSync("data/morpheme-review/2026-11-25-pass-02.json")
const checksum = "5a558ff2349e82574e36a48be3671c0ba9e197df557c18b41b0be3560a98bc5e"
if (createHash("sha256").update(data).digest("hex") !== checksum) {
    throw new Error("The reviewed decisions do not match this script version")
}
const { confirmed, rejected } = JSON.parse(data.toString("utf8")) as Review

const apply = process.argv.includes("--apply")
const databasePath = process.env.SQLITE_DB
if (!databasePath) throw new Error("SQLITE_DB is required. Use npm run db:run.")
const db = new Database(databasePath, { readonly: !apply, fileMustExist: true })
db.pragma("foreign_keys = ON")
db.pragma("busy_timeout = 10000")

function run() {
    const readWord = db.prepare<[number], Omit<Word, "ru">>(`
        SELECT id, slug, value, pos, stem FROM lexemes WHERE id = ? AND isPublic = 1
    `)
    const translations = db.prepare<[number], { value: string | null }>(`
        SELECT DISTINCT t.value FROM translations t JOIN meanings m ON m.id = t.meaningId
        WHERE m.lexemeId = ? AND t.language = 'ru' ORDER BY t.value
    `).pluck()
    const checkedWords = new Set<number>()
    function validateWord(expected: Word) {
        if (checkedWords.has(expected.id)) return
        const word = readWord.get(expected.id)
        if (!word || word.slug !== expected.slug || word.value !== expected.value ||
            word.pos !== expected.pos || word.stem !== expected.stem ||
            JSON.stringify(translations.all(expected.id)) !== JSON.stringify(expected.ru)) {
            throw new Error(`Lexeme #${expected.id} ${expected.value} changed after review`)
        }
        checkedWords.add(expected.id)
    }

    const find = db.prepare<[number, string], { id: number }>("SELECT id FROM morphemes WHERE type = ? AND value = ?")
    const prefixNames = new Set(["bez", "do", "na", "ne", "pri"])
    const decisions = new Map<number, { add: Set<number>; remove: Set<number> }>()
    for (const row of [...confirmed, ...rejected]) {
        const { lexeme, affix } = row
        validateWord(lexeme)
        const matches = find.all(prefixNames.has(affix) ? 1 : 2, affix)
        if (matches.length !== 1) throw new Error(`Expected a single affix named ${affix}`)
        const [match] = matches
        const decision = decisions.get(lexeme.id) ?? { add: new Set<number>(), remove: new Set<number>() }
        decisions.set(lexeme.id, decision)
        if ("base" in row) {
            validateWord(row.base)
            decision.add.add(match.id)
            if (row.removeRootId) {
                const oldRoot = find.all(0, "pri").find(({ id }) => id === row.removeRootId)
                if (!oldRoot) throw new Error("The old pri root was changed")
                decision.remove.add(oldRoot.id)
            }
        } else if (row.remove) {
            decision.remove.add(match.id)
        } else {
            const linked = db.prepare("SELECT id FROM lexemes_morphemes WHERE lexemeId = ? AND morphemeId = ?").get(lexeme.id, match.id)
            if (linked) throw new Error(`Rejected pair #${lexeme.id} / ${affix} now has a link. Review the change first.`)
        }
    }

    const existing = db.prepare<[number], { morphemeId: number }>(`
        SELECT DISTINCT morphemeId FROM lexemes_morphemes
        WHERE lexemeId = ? AND morphemeId IS NOT NULL ORDER BY morphemeId
    `)
    const addLink = db.prepare("INSERT INTO lexemes_morphemes (lexemeId, morphemeId) VALUES (?, ?)")
    const removeLink = db.prepare("DELETE FROM lexemes_morphemes WHERE lexemeId = ? AND morphemeId = ?")
    const touch = db.prepare("UPDATE lexemes SET updatedAt = ? WHERE id = ?")
    const audit = db.prepare(`
        INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userEmail)
        VALUES (?, 'Lexeme', ?, 'morphemeIds', ?, ?, 'script:review-morpheme-affixes-02')
    `)
    const time = new Date().toISOString()
    let additions = 0
    let removals = 0
    for (const [id, { add, remove }] of decisions) {
        const before = existing.all(id).map(({ morphemeId }) => morphemeId)
        const after = new Set(before)
        const removed = [...remove].filter((morphemeId) => after.delete(morphemeId))
        const added = [...add].filter((morphemeId) => !after.has(morphemeId))
        if (added.length === 0 && removed.length === 0) continue
        console.log(`#${id}: +[${added.join(", ")}] −[${removed.join(", ")}]`)
        additions += added.length
        removals += removed.length
        if (!apply) continue

        for (const morphemeId of removed) removeLink.run(id, morphemeId)
        for (const morphemeId of added) {
            addLink.run(id, morphemeId)
            after.add(morphemeId)
        }
        touch.run(time, id)
        audit.run(randomUUID(), id, JSON.stringify(before), JSON.stringify([...after].sort((a, b) => a - b)))
    }
    console.log(JSON.stringify({ apply, confirmed: confirmed.length, rejected: rejected.length, additions, removals }))
}

try {
    const transaction = db.transaction(run)
    if (apply) transaction.immediate()
    else transaction.deferred()
} finally {
    db.close()
}
