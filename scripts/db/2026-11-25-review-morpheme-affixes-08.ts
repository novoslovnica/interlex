import { createHash, randomUUID } from "node:crypto"
import Database from "better-sqlite3"

const roots = [
    { value: "lov", core: "lov", members: [1292, 1529, 11026, 11027, 11031, 11033] },
    { value: "lec", core: "lěč", members: [4353, 10694, 10695, 10696, 10698] },
] as const

// Existing members of lodz include the unrelated family of boats. The town
// name sgorelec loses only its demonstrably unrelated 'betray' root.
const oldLinks = new Map<number, number>([[1529, 723], [11027, 723], [988, 467], [3015, 467]])
const evidenceIds = [800, 988, 1292, 1529, 3015, 4353, 7890, 10694, 10695, 10696, 10698, 11026, 11027, 11031, 11033]

const databasePath = process.env.SQLITE_DB
if (!databasePath) throw new Error("SQLITE_DB is required. Use npm run db:run.")
const apply = process.argv.includes("--apply")
const db = new Database(databasePath, { readonly: !apply, fileMustExist: true })
db.pragma("foreign_keys = ON")
db.pragma("busy_timeout = 10000")

function run() {
    const readEvidence = db.prepare<[number]>(`
        SELECT id, slug, value, stem, pos, (SELECT json_group_array(value) FROM (
            SELECT DISTINCT t.value FROM translations t JOIN meanings m ON m.id=t.meaningId
            WHERE m.lexemeId=l.id AND t.language='ru' ORDER BY t.value
        )) AS ru FROM lexemes l WHERE l.id = ?
    `)
    const digest = createHash("sha256").update(JSON.stringify(evidenceIds.map((id) => readEvidence.get(id)))).digest("hex")
    if (digest !== "5aa8fbfcff8529182308f51733077bbea2c4432450a94ecdc5f078956f74ae23") {
        throw new Error("Reviewed dictionary forms or meanings changed. Repeat editorial verification.")
    }

    const checkRoot = db.prepare<[number, string]>("SELECT id FROM morphemes WHERE id = ? AND value = ? AND type = 0")
    for (const [id, value] of [[378, "gor"], [467, "zdrad"], [723, "lodz"]] as const) {
        if (!checkRoot.get(id, value)) throw new Error(`Expected root #${id} ${value}`)
    }
    const core = db.prepare<[], { id: number }>("SELECT id FROM allophone_flavors WHERE code = 'CORE'").get()
    if (!core) throw new Error("CORE is required")

    const time = new Date().toISOString()
    const audit = db.prepare(`
        INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userEmail)
        VALUES (?, ?, ?, ?, ?, ?, 'script:review-morpheme-affixes-08')
    `)
    const findRoot = db.prepare<[string, string], { id: number; core: string | null }>(`
        SELECT DISTINCT m.id, core.value AS core FROM morphemes m
        LEFT JOIN morpheme_allophones core ON core.morphemeId = m.id AND core.flavorId = (
            SELECT id FROM allophone_flavors WHERE code = 'CORE'
        )
        WHERE m.type = 0 AND (m.value = ? COLLATE NOCASE OR core.value = ? COLLATE NOCASE)
    `)
    const want = new Map<number, number | null>([[988, 378], [3015, null], [7890, 378]])
    let createdRoots = 0
    for (const family of roots) {
        const matches = findRoot.all(family.value, family.core)
        if (matches.length > 1 || (matches.length === 1 && matches[0].core !== family.core)) {
            throw new Error(`Ambiguous existing root ${family.core}`)
        }
        let rootId = matches[0]?.id
        if (rootId === undefined) {
            console.log(`${apply ? "Создан" : "К созданию"} корень ${family.value}, CORE ${family.core}`)
            createdRoots++
            rootId = -createdRoots
            if (apply) {
                rootId = Number(db.prepare("INSERT INTO morphemes (value, type, updatedAt) VALUES (?, 0, ?)")
                    .run(family.value, time).lastInsertRowid)
                db.prepare("INSERT INTO morpheme_allophones (morphemeId, flavorId, value) VALUES (?, ?, ?)")
                    .run(rootId, core.id, family.core)
                const action = randomUUID()
                audit.run(action, "Morpheme", rootId, "value", null, family.value)
                audit.run(action, "Morpheme", rootId, "type", null, "0")
                audit.run(action, "Morpheme", rootId, "CORE", null, family.core)
            }
        }
        for (const id of family.members) want.set(id, rootId)
    }

    const readLinks = db.prepare<[number], { morphemeId: number }>(`
        SELECT DISTINCT morphemeId FROM lexemes_morphemes
        WHERE lexemeId = ? AND morphemeId IS NOT NULL ORDER BY morphemeId
    `)
    const add = db.prepare("INSERT INTO lexemes_morphemes (lexemeId, morphemeId) VALUES (?, ?)")
    const remove = db.prepare("DELETE FROM lexemes_morphemes WHERE lexemeId = ? AND morphemeId = ?")
    const touch = db.prepare("UPDATE lexemes SET updatedAt = ? WHERE id = ?")
    let additions = 0
    let removals = 0
    for (const [id, newRootId] of want) {
        const before = readLinks.all(id).map(({ morphemeId }) => morphemeId)
        const after = new Set(before)
        const old = oldLinks.get(id)
        const removed = old !== undefined && after.delete(old)
        const added = newRootId !== null && !after.has(newRootId)
        if (!added && !removed) continue
        if (old !== undefined && !removed && added) {
            throw new Error(`Legacy root link #${id} / #${old} was removed after review`)
        }

        console.log(`#${id}: +[${added ? newRootId : ""}] −[${removed ? old : ""}]`)
        additions += Number(added)
        removals += Number(removed)
        if (!apply) continue
        if (removed) remove.run(id, old)
        if (added) {
            add.run(id, newRootId)
            after.add(newRootId)
        }
        touch.run(time, id)
        audit.run(randomUUID(), "Lexeme", id, "morphemeIds", JSON.stringify(before), JSON.stringify([...after].sort((a, b) => a - b)))
    }
    console.log(JSON.stringify({ apply, createdRoots, additions, removals }))
}

try {
    const transaction = db.transaction(run)
    if (apply) transaction.immediate()
    else transaction.deferred()
} finally {
    db.close()
}
