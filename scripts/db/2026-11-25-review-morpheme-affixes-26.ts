import { createHash, randomUUID } from "node:crypto"
import Database from "better-sqlite3"

// The uč- family includes the contrasting stems uči-, uča- and učeń-.
// https://interslavic.fun/standard/morphology/derivation/#agent-and-instrument-nouns
const rootId = 479
const originalMembers = [1006, 1886, 2599, 3578, 3583, 20208]
const addedMembers = [20194, 20209, 20211]
const evidence = [...originalMembers, ...addedMembers].sort((left, right) => left - right)

const path = process.env.SQLITE_DB
if (!path) throw new Error("SQLITE_DB is required. Use npm run db:run.")
const apply = process.argv.includes("--apply")
const db = new Database(path, { readonly: !apply, fileMustExist: true })
db.pragma("foreign_keys = ON")
db.pragma("busy_timeout = 10000")

function review() {
    const lexeme = db.prepare<[number]>(`
        SELECT id, slug, value, stem, pos, (SELECT json_group_array(value) FROM (
            SELECT DISTINCT t.value FROM translations t JOIN meanings m ON m.id = t.meaningId
            WHERE m.lexemeId = l.id AND t.language = 'ru' ORDER BY t.value
        )) AS ru FROM lexemes l WHERE isPublic = 1 AND l.id = ?
    `)
    const digest = createHash("sha256").update(JSON.stringify(evidence.map((id) => lexeme.get(id)))).digest("hex")
    if (digest !== "2072a8448f28d25421849ecd8deeaf94723457f688cef9ef982761edd4891f51") {
        throw new Error("Reviewed uč- forms or meanings changed")
    }

    const root = db.prepare<[number], { value: string }>("SELECT value FROM morphemes WHERE id = ? AND type = 0").get(rootId)
    const variants = db.prepare<[number], { id: number; code: string; value: string }>(`
        SELECT a.id, f.code, a.value FROM morpheme_allophones a
        JOIN allophone_flavors f ON f.id = a.flavorId WHERE a.morphemeId = ?
    `).all(rootId)
    const [core] = variants
    const correct = root?.value === "uc" && core?.value === "uč"
    const original = root?.value === "uci" && core?.value === "uci"
    const overlap = db.prepare<[number]>("SELECT id FROM morphemes WHERE id <> ? AND type = 0 AND value IN ('uc', 'uč')").all(rootId)
    if ((!original && !correct) || variants.length !== 1 || core.code !== "CORE" || overlap.length > 0) {
        throw new Error("The root #479 or its variants changed after review")
    }

    const current = new Set(db.prepare<[number], { id: number }>(`
        SELECT DISTINCT lexemeId AS id FROM lexemes_morphemes WHERE morphemeId = ?
    `).all(rootId).map(({ id }) => id))
    if (originalMembers.some((id) => !current.has(id)) || [...current].some((id) => !evidence.includes(id))) {
        throw new Error("Membership of the uč- family changed after review")
    }

    const missing = addedMembers.filter((id) => !current.has(id))
    console.log(JSON.stringify({ apply, correctedRoots: Number(original), additions: missing.length, removals: 0 }))
    if (!apply) return
    const time = new Date().toISOString()
    const audit = db.prepare(`
        INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userEmail)
        VALUES (?, ?, ?, ?, ?, ?, 'script:review-morpheme-affixes-26')
    `)
    if (original) {
        db.prepare("UPDATE morphemes SET value = 'uc', updatedAt = ? WHERE id = ?").run(time, rootId)
        db.prepare("UPDATE morpheme_allophones SET value = 'uč' WHERE id = ?").run(core.id)
        const action = randomUUID()
        audit.run(action, "Morpheme", rootId, "value", "uci", "uc")
        audit.run(action, "Morpheme", rootId, "CORE", "uci", "uč")
    }
    const readLinks = db.prepare<[number], { morphemeId: number }>(`
        SELECT DISTINCT morphemeId FROM lexemes_morphemes
        WHERE lexemeId = ? AND morphemeId IS NOT NULL ORDER BY morphemeId
    `)
    const link = db.prepare("INSERT INTO lexemes_morphemes (lexemeId, morphemeId) VALUES (?, ?)")
    const updateLexeme = db.prepare("UPDATE lexemes SET updatedAt = ? WHERE id = ?")
    for (const id of missing) {
        const before = readLinks.all(id).map(({ morphemeId }) => morphemeId)
        link.run(id, rootId)
        updateLexeme.run(time, id)
        const after = [...before, rootId].sort((left, right) => left - right)
        audit.run(randomUUID(), "Lexeme", id, "morphemeIds", JSON.stringify(before), JSON.stringify(after))
    }
}

try {
    const transaction = db.transaction(review)
    if (apply) transaction.immediate()
    else transaction.deferred()
} finally {
    db.close()
}
