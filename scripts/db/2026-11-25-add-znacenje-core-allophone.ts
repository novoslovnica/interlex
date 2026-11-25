import { randomUUID } from "node:crypto"
import Database from "better-sqlite3"

const lexemeId = 25508
const slug = "znacenje-NOUN-2"
const spelling = "značenje"
const apply = process.argv.includes("--apply")
const db = new Database(process.env.SQLITE_DB ?? "interlex.db", { readonly: !apply, fileMustExist: true })

try {
    function addAllophone() {
        const lexeme = db.prepare("SELECT id FROM lexemes WHERE id = ? AND slug = ? AND value = ?").get(lexemeId, slug, "znacenje")
        if (!lexeme) throw new Error(`Запись ${lexemeId} (${slug}) отсутствует или была изменена`)

        const flavor = db.prepare<[], { id: number }>("SELECT id FROM allophone_flavors WHERE code = 'CORE'").get()
        if (!flavor) throw new Error("Отсутствует вариант CORE")

        const existing = db.prepare<[number, number], { value: string }>(`
            SELECT value FROM lexeme_allophones WHERE lexemeId = ? AND flavorId = ? AND type = 'standard'
        `).get(lexemeId, flavor.id)
        if (existing) {
            if (existing.value !== spelling) throw new Error(`В записи ${lexemeId} уже указан другой аллофон CORE: ${existing.value}`)
            console.log(`Уже добавлен: ${spelling}`)
            return
        }

        if (apply) {
            db.prepare("INSERT INTO lexeme_allophones (lexemeId, flavorId, type, value) VALUES (?, ?, 'standard', ?)")
                .run(lexemeId, flavor.id, spelling)
            db.prepare("UPDATE lexemes SET updatedAt = ? WHERE id = ?")
                .run(new Date().toISOString().replace("Z", "+00:00"), lexemeId)
            db.prepare(`
                INSERT INTO audit_logs (actionId, entityType, entityId, field, newValue, userEmail)
                VALUES (?, 'Lexeme', ?, 'isv', ?, 'script:add-znacenje-core-allophone')
            `).run(randomUUID(), lexemeId, spelling)
        }
        console.log(`${apply ? "Добавлен" : "К добавлению"}: ${spelling}`)
    }

    if (apply) db.transaction(addAllophone).immediate()
    else addAllophone()
} finally {
    db.close()
}
