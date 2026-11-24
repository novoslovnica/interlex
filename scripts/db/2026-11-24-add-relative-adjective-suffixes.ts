import { randomUUID } from "node:crypto"
import { resolve } from "node:path"
import Database from "better-sqlite3"
import { MorphemeType } from "@/lib/grammar/common/morpheme"

const examples = [
    { suffix: "ov", cyrillic: "ов", slug: "domovy-ADJ" },
    { suffix: "ev", cyrillic: "ев", slug: "aluminijevy-ADJ" },
    { suffix: "sk", cyrillic: "ск", slug: "slovjansky-ADJ" },
] as const

const apply = process.argv.includes("--apply")
const db = new Database(process.env.SQLITE_DB || resolve("interlex.db"), { readonly: !apply, fileMustExist: true })
const findSuffix = db.prepare(`
    SELECT id FROM morphemes
    WHERE type = ? AND lower(trim(trim(value), '-')) IN (?, ?, ?)
    ORDER BY id
`)
const findAdjective = db.prepare("SELECT id FROM lexemes WHERE slug = ? AND pos = 'ADJ'")
const linked = db.prepare("SELECT 1 FROM lexemes_morphemes WHERE lexemeId = ? AND morphemeId = ?")

function planChanges() {
    return examples.map(({ suffix, cyrillic, slug }) => {
        const lexeme = findAdjective.get(slug) as { id: number } | undefined
        if (!lexeme) throw new Error(`Прилагательное ${slug} отсутствует`)
        const variants = findSuffix.all(MorphemeType.SUFFIX, suffix, cyrillic, cyrillic.toUpperCase()) as { id: number }[]
        const existingLink = variants.find(({ id }) => linked.get(lexeme.id, id))
        const morpheme = existingLink ?? variants[0]
        return { suffix, slug, lexemeId: lexeme.id, morphemeId: morpheme?.id, alreadyLinked: !!existingLink }
    })
}

function describe(changes: ReturnType<typeof planChanges>) {
    for (const { suffix, slug, morphemeId, alreadyLinked } of changes) {
        console.log(`-${suffix}-  ${morphemeId == null ? "создать суффикс" : "суффикс уже есть"}  ·  ${slug}  ${alreadyLinked ? "уже связан" : "связать"}`)
    }
}

try {
    if (!apply) {
        describe(planChanges())
    } else {
        const insertSuffix = db.prepare("INSERT INTO morphemes (value, type, updatedAt) VALUES (?, ?, ?)")
        const insertLink = db.prepare("INSERT INTO lexemes_morphemes (lexemeId, morphemeId) VALUES (?, ?)")
        const touchLexeme = db.prepare("UPDATE lexemes SET updatedAt = ? WHERE id = ?")
        const audit = db.prepare(`
            INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userEmail, createdAt)
            VALUES (?, ?, ?, ?, NULL, ?, 'script:add-relative-adjective-suffixes', CURRENT_TIMESTAMP)
        `)
        const changes = db.transaction(() => {
            const planned = planChanges()
            const now = new Date().toISOString().replace("Z", "+00:00")
            for (const { suffix, lexemeId, morphemeId, alreadyLinked } of planned) {
                if (alreadyLinked) continue
                const id = morphemeId ?? Number(insertSuffix.run(suffix, MorphemeType.SUFFIX, now).lastInsertRowid)
                if (morphemeId == null) {
                    const actionId = randomUUID()
                    audit.run(actionId, "Morpheme", id, "value", suffix)
                    audit.run(actionId, "Morpheme", id, "type", String(MorphemeType.SUFFIX))
                }
                insertLink.run(lexemeId, id)
                touchLexeme.run(now, lexemeId)
                audit.run(randomUUID(), "Lexeme", lexemeId, "morpheme.added", String(id))
            }
            return planned
        }).immediate()
        describe(changes)
    }
} finally {
    db.close()
}
