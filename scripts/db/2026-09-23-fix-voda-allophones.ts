// One-off data fix. Lexeme 21153 "voda-NOUN" (water) carries the standard
// allophones of a different word - CORE/WEST "vođa", EAST/SOUTH "воđа" -
// left over from the 2026-09-16 legacy merge: the real water word (legacy
// 3856, CORE "voda", NSL "вода") was merged INTO a corrupted new-format
// record that already had these allophones. ISV "voda" has no diacritic,
// so the fix direction is unambiguous. Idempotent; one audit_logs row per
// changed allophone; Lexeme.updatedAt is bumped for corpus-refresh.
//
// Usage: npx tsx scripts/db/2026-09-23-fix-voda-allophones.ts [--apply]

import Database from "better-sqlite3"
import { randomUUID } from "crypto"
import path from "path"

const LEXEME_ID = 21153
const FIX: Record<string, [string, string]> = { CORE: ["vođa", "voda"], WEST: ["vođa", "voda"], EAST: ["воđа", "вода"], SOUTH: ["воđа", "вода"] }
const APPLY = process.argv.includes("--apply")
const db = new Database(process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db"), { readonly: !APPLY })

const lexeme = db.prepare(`SELECT slug, value FROM lexemes WHERE id = ?`).get(LEXEME_ID) as { slug: string; value: string } | undefined
if (!lexeme || lexeme.value !== "voda") throw new Error(`Lexeme ${LEXEME_ID} is not "voda": ${JSON.stringify(lexeme)}`)

const rows = db.prepare(`
    SELECT la.id, af.code, la.value FROM lexeme_allophones la JOIN allophone_flavors af ON af.id = la.flavorId
    WHERE la.lexemeId = ? AND la.type = 'standard'
`).all(LEXEME_ID) as { id: number; code: string; value: string }[]
const changes = rows.filter((row) => FIX[row.code] && row.value === FIX[row.code][0])
for (const row of rows) console.log(`${row.code}: ${row.value}${FIX[row.code] && row.value === FIX[row.code][0] ? ` -> ${FIX[row.code][1]}` : ""}`)

if (!APPLY) { console.log(`\nDry run: ${changes.length} rows to change. Re-run with --apply.`); process.exit(0) }
db.transaction(() => {
    const actionId = randomUUID()
    for (const row of changes) {
        db.prepare(`UPDATE lexeme_allophones SET value = ? WHERE id = ? AND value = ?`).run(FIX[row.code][1], row.id, row.value)
        db.prepare(`INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail) VALUES (?, 'Lexeme', ?, ?, ?, ?, NULL, 'script:fix-voda-allophones')`)
            .run(actionId, LEXEME_ID, row.code === "CORE" ? "isv" : `allophone.${row.code}`, row.value, FIX[row.code][1])
    }
    if (changes.length > 0) db.prepare(`UPDATE lexemes SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(LEXEME_ID)
})()
console.log(`\nChanged ${changes.length} allophones.`)
