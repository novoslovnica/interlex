import { randomUUID } from "node:crypto"
import Database from "better-sqlite3"

const actor = "script:review-morpheme-affixes"
const apply = process.argv.includes("--apply")

// The inventory includes the segment before the inflectional ending.
// Sources: https://interslavic.fun/learn/vocabulary/word-formation/
//          https://interslavic.fun/standard/morphology/derivation/
const inventory = {
    bez: { type: 1, value: "bez" },
    do: { type: 1, value: "do" },
    na: { type: 1, value: "na" },
    ne: { type: 1, value: "ne" },
    pri: { type: 1, value: "pri" },
    ak: { type: 2, value: "ak" },
    ec: { type: 2, value: "ec" },
    k: { type: 2, value: "k" },
    n: { type: 2, value: "n" },
    nik: { type: 2, value: "nik" },
    ost: { type: 2, value: "ost" },
    stv: { type: 2, value: "stv" },
    telj: { type: 2, value: "telj" },
} as const satisfies Record<string, { type: 1 | 2; value: string }>

const roots = {
    brat: [127, "brat"],
    dobr: [248, "dobr"],
    govor: [251, "govor"],
    glav: [354, "glav"],
    inak: [461, "inak"],
    let: [702, "let"],
    pis: [876, "pis"],
    slov: [900, "slov"],
    oldPri: [1718, "pri"],
} as const

const bookRoot = { id: 585, before: "kni", after: "knig", members: [1217, 1218, 1219, 1220, 1222, 9849, 9855] }

type Affix = keyof typeof inventory
type Root = keyof typeof roots
type MorphemeKey = Affix | Root

interface Decision {
    id: number
    slug: string
    value: string
    add?: readonly MorphemeKey[]
    remove?: readonly Root[]
    evidence: string
}

// Reviewed lexical pairs only. Productive spellings and unrestricted
// substring matches belong to the separate editorial queue.
const decisions: readonly Decision[] = [
    { id: 5339, slug: "bezdomny-ADJ", value: "bezdomny", add: ["bez", "n"], evidence: "dom → bezdomny" },
    { id: 5373, slug: "beznadejny-ADJ", value: "beznadejny", add: ["bez", "n"], evidence: "nadeja → beznadejny" },
    { id: 5737, slug: "bratstvo-NOUN", value: "bratstvo", add: ["brat", "stv"], evidence: "brat → bratstvo" },
    { id: 6689, slug: "dobrost-NOUN", value: "dobrost", add: ["dobr", "ost"], evidence: "dobry → dobrost" },
    { id: 6848, slug: "dopisati-VERB", value: "dopisati", add: ["do", "pis"], evidence: "pisati «писать» → dopisati" },
    { id: 6858, slug: "dopolniti-VERB", value: "dopolniti", add: ["do"], evidence: "polniti → dopolniti" },
    { id: 771, slug: "glupec-n", value: "glupec", add: ["ec"], evidence: "glupy → glupec" },
    { id: 7762, slug: "glavnik-NOUN", value: "glavnik", add: ["glav", "nik"], evidence: "glava → glavnik" },
    { id: 7937, slug: "govoritelj-NOUN", value: "govoritelj", add: ["govor", "telj"], evidence: "govoriti → govoritelj" },
    { id: 8555, slug: "informacija-NOUN", value: "informacija", remove: ["inak"], evidence: "informacija не входит в семью inako" },
    { id: 9855, slug: "knizka-NOUN", value: "knizka", add: ["k"], evidence: "kniga → knižka, g → ž" },
    { id: 12224, slug: "napisati-VERB", value: "napisati", add: ["na", "pis"], evidence: "pisati «писать» → napisati" },
    { id: 12518, slug: "nedobry-ADJ", value: "nedobry", add: ["dobr", "ne"], evidence: "dobry → nedobry" },
    { id: 14867, slug: "pisatelj-NOUN", value: "pisatelj", add: ["pis", "telj"], evidence: "pisati «писать» → pisatelj" },
    { id: 16364, slug: "prijateljstvo-NOUN", value: "prijateljstvo", add: ["stv"], evidence: "prijatelj → prijateljstvo" },
    { id: 16372, slug: "prijdti-VERB", value: "prijdti", add: ["pri"], remove: ["oldPri"], evidence: "idti → prijdti" },
    { id: 16397, slug: "prileteti-VERB", value: "prileteti", add: ["pri", "let"], remove: ["oldPri"], evidence: "leteti → prileteti" },
    { id: 16442, slug: "pripisati-VERB", value: "pripisati", add: ["pri", "pis"], remove: ["oldPri"], evidence: "pisati «писать» → pripisati" },
    { id: 17894, slug: "rybak-NOUN", value: "rybak", add: ["ak"], evidence: "ryba → rybak" },
    { id: 18516, slug: "slovnik-NOUN", value: "slovnik", add: ["slov", "nik"], evidence: "slovo → slovnik" },
    { id: 20208, slug: "ucitelj-NOUN", value: "ucitelj", add: ["telj"], evidence: "uciti → ucitelj" },
]

const databasePath = process.env.SQLITE_DB
if (!databasePath) throw new Error("SQLITE_DB is required. Use npm run db:run.")

const db = new Database(databasePath, { readonly: !apply, fileMustExist: true })
db.pragma("foreign_keys = ON")
db.pragma("busy_timeout = 10000")

function run() {
    const timestamp = new Date().toISOString()
    const audit = db.prepare<[string, string, number, string, string | null, string | null]>(`
        INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userEmail)
        VALUES (?, ?, ?, ?, ?, ?, '${actor}')
    `)
    const book = db.prepare<[number], { value: string; stressPosition: number | null; protoSlavicWordId: number | null }>(`
        SELECT value, stressPosition, protoSlavicWordId FROM morphemes WHERE id = ? AND type = 0
    `).get(bookRoot.id)
    const bookVariants = db.prepare<[number], { id: number; code: string; value: string }>(`
        SELECT a.id, f.code, a.value FROM morpheme_allophones a
        JOIN allophone_flavors f ON f.id = a.flavorId WHERE a.morphemeId = ?
    `).all(bookRoot.id)
    const bookMembers = db.prepare<[number], { lexemeId: number }>(`
        SELECT DISTINCT lexemeId FROM lexemes_morphemes WHERE morphemeId = ? ORDER BY lexemeId
    `).all(bookRoot.id).map(({ lexemeId }) => lexemeId)
    const [core] = bookVariants
    const correctBookRoot = book?.value === bookRoot.after && core?.value === bookRoot.after
    if (!correctBookRoot) {
        if (book?.value !== bookRoot.before || book.stressPosition !== null || book.protoSlavicWordId !== null ||
            bookVariants.length !== 1 || core.code !== "CORE" || core.value !== bookRoot.before ||
            JSON.stringify(bookMembers) !== JSON.stringify(bookRoot.members) ||
            db.prepare("SELECT id FROM morphemes WHERE type = 0 AND value = ? COLLATE NOCASE").get(bookRoot.after)) {
            throw new Error("Family #585 kni changed after editorial review")
        }
        console.log(`#${bookRoot.id} ${bookRoot.before} → ${bookRoot.after} (корень и CORE, чередование g/ž)`)
        if (apply) {
            db.prepare("UPDATE morphemes SET value = ?, updatedAt = ? WHERE id = ?").run(bookRoot.after, timestamp, bookRoot.id)
            db.prepare("UPDATE morpheme_allophones SET value = ? WHERE id = ?").run(bookRoot.after, core.id)
            const action = randomUUID()
            audit.run(action, "Morpheme", bookRoot.id, "value", bookRoot.before, bookRoot.after)
            audit.run(action, "Morpheme", bookRoot.id, "CORE", bookRoot.before, bookRoot.after)
        }
    }
    const ids = new Map<MorphemeKey, number>()
    // Compare the same spelling to both the canonical value and stored variants.
    const matchingAffix = db.prepare<[number, string, string], { id: number }>(`
        SELECT DISTINCT m.id FROM morphemes m
        LEFT JOIN morpheme_allophones a ON a.morphemeId = m.id
        WHERE m.type = ? AND (m.value = ? COLLATE NOCASE OR a.value = ? COLLATE NOCASE)
    `)
    const create = db.prepare<[string, number, string]>(`
        INSERT INTO morphemes (value, type, updatedAt) VALUES (?, ?, ?)
    `)
    let missing = 0
    for (const [key, { type, value }] of Object.entries(inventory) as [Affix, (typeof inventory)[Affix]][]) {
        const matches = matchingAffix.all(type, value, value)
        if (matches.length > 1) throw new Error(`Ambiguous affix ${value}: ${matches.map(({ id }) => id).join(", ")}`)
        if (matches.length === 1) {
            ids.set(key, matches[0].id)
            continue
        }

        missing++
        console.log(`${apply ? "Создан" : "К созданию"} аффикс ${value} (тип ${type})`)
        if (!apply) {
            ids.set(key, -missing)
            continue
        }
        const id = Number(create.run(value, type, timestamp).lastInsertRowid)
        ids.set(key, id)
        const action = randomUUID()
        audit.run(action, "Morpheme", id, "value", null, value)
        audit.run(action, "Morpheme", id, "type", null, String(type))
    }

    const verifyRoot = db.prepare<[number, string]>("SELECT id FROM morphemes WHERE id = ? AND type = 0 AND value = ?")
    for (const [key, [id, value]] of Object.entries(roots) as [Root, (typeof roots)[Root]][]) {
        if (!verifyRoot.get(id, value)) throw new Error(`Root #${id} ${value} was changed`)
        ids.set(key, id)
    }
    function idFor(key: MorphemeKey) {
        const id = ids.get(key)
        if (id === undefined) throw new Error(`Missing morpheme ${key}`)
        return id
    }

    const verifyLexeme = db.prepare<[number, string, string]>("SELECT id FROM lexemes WHERE id = ? AND slug = ? AND value = ?")
    const currentLinks = db.prepare<[number], { morphemeId: number }>(`
        SELECT DISTINCT morphemeId FROM lexemes_morphemes
        WHERE lexemeId = ? AND morphemeId IS NOT NULL ORDER BY morphemeId
    `)
    const removeLink = db.prepare("DELETE FROM lexemes_morphemes WHERE lexemeId = ? AND morphemeId = ?")
    const addLink = db.prepare("INSERT INTO lexemes_morphemes (lexemeId, morphemeId) VALUES (?, ?)")
    const touch = db.prepare("UPDATE lexemes SET updatedAt = ? WHERE id = ?")
    let additions = 0
    let removals = 0
    for (const { id, slug, value, add = [], remove = [], evidence } of decisions) {
        if (!verifyLexeme.get(id, slug, value)) throw new Error(`Lexeme #${id} ${slug} was changed`)

        const before = currentLinks.all(id).map(({ morphemeId }) => morphemeId)
        const after = new Set(before)
        const toRemove = remove.filter((key) => after.delete(idFor(key)))
        const toAdd = add.filter((key) => !after.has(idFor(key)))
        if (toRemove.length === 0 && toAdd.length === 0) continue
        for (const key of toAdd) after.add(idFor(key))
        additions += toAdd.length
        removals += toRemove.length
        console.log(`#${id} ${value}: +[${toAdd.join(", ")}] −[${toRemove.join(", ")}] · ${evidence}`)
        if (!apply) continue

        for (const key of toRemove) removeLink.run(id, idFor(key))
        for (const key of toAdd) addLink.run(id, idFor(key))
        touch.run(timestamp, id)
        audit.run(randomUUID(), "Lexeme", id, "morphemeIds", JSON.stringify(before), JSON.stringify([...after].sort((a, b) => a - b)))
    }
    console.log(JSON.stringify({ apply, missingAffixes: missing, additions, removals, correctedRoots: correctBookRoot ? 0 : 1 }))
}

try {
    const transaction = db.transaction(run)
    if (apply) transaction.immediate()
    else transaction.deferred()
} finally {
    db.close()
}
