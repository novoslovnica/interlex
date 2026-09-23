// One-off data fix decided by the maintainer 2026-09-23 - three words, three
// meanings, after the 2026-09-16 legacy merge had glued them onto voda:
//   voda    (21153) - water:  meaning 4166 keeps the definition, takes the
//                     verified translations of 22558; 22558 is deleted.
//   vođa    (21181, was value "vod"/"vođ") - leader: takes 22558's
//                     definition/example; becomes an a-stem (jā, paradigm A).
//   vođica  (new)   - rein(s): meaning 22587 (rein translations, empty
//                     definition - left for the maintainer) moves onto it.
// Also drops 21153 from base_homonyms "vođ" (it sat there because of the
// wrong allophones fixed by 2026-09-23-fix-voda-allophones.ts). Relations and
// synset links of 22558 (all water, matched via ru «вода») go to 4166.
// Idempotent; audited; updatedAt set by hand (corpus-refresh watermark).
//
// Usage: npx tsx scripts/db/2026-09-23-split-voda-vodja-vodjica.ts [--apply]

import Database from "better-sqlite3"
import { randomUUID } from "crypto"
import path from "path"

const APPLY = process.argv.includes("--apply")
const db = new Database(process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db"), { readonly: !APPLY })
const VODA = 21153, VODJA = 21181, M_WATER = 4166, M_LEADER_TEXT = 22558, M_LEADER = 22586, M_REIN = 22587
const FLAVOR = Object.fromEntries((db.prepare(`SELECT id, code FROM allophone_flavors`).all() as { id: number; code: string }[]).map((f) => [f.code, f.id]))
const AUDIT_EMAIL = "script:split-voda-vodja-vodjica"

const audit = (actionId: string, lexemeId: number, field: string, oldValue: unknown, newValue: unknown) =>
    db.prepare(`INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail) VALUES (?, 'Lexeme', ?, ?, ?, ?, NULL, ?)`)
        .run(actionId, lexemeId, field, oldValue == null ? null : String(oldValue), newValue == null ? null : String(newValue), AUDIT_EMAIL)
const setAllophone = (actionId: string, lexemeId: number, code: string, value: string) => {
    const row = db.prepare(`SELECT id, value FROM lexeme_allophones WHERE lexemeId = ? AND flavorId = ? AND type = 'standard'`).get(lexemeId, FLAVOR[code]) as { id: number; value: string } | undefined
    if (row?.value === value) return
    if (row) db.prepare(`UPDATE lexeme_allophones SET value = ? WHERE id = ?`).run(value, row.id)
    else db.prepare(`INSERT INTO lexeme_allophones (lexemeId, flavorId, type, value) VALUES (?, ?, 'standard', ?)`).run(lexemeId, FLAVOR[code], value)
    audit(actionId, lexemeId, code === "CORE" ? "isv" : `allophone.${code}`, row?.value ?? null, value)
}

const leaderText = db.prepare(`SELECT meaning, examples FROM meanings WHERE id = ?`).get(M_LEADER_TEXT) as { meaning: string; examples: string | null } | undefined
const reinMeaning = db.prepare(`SELECT lexemeId FROM meanings WHERE id = ?`).get(M_REIN) as { lexemeId: number } | undefined
console.log(`22558 present: ${Boolean(leaderText)}; 22587 on lexeme: ${reinMeaning?.lexemeId}; vođica exists: ${Boolean(db.prepare(`SELECT 1 FROM lexemes WHERE value = 'vođica'`).get())}`)
if (!APPLY) { console.log("Dry run. Re-run with --apply."); process.exit(0) }

db.transaction(() => {
    // --- A. voda: fold 22558 into 4166 -------------------------------------
    if (leaderText) {
        const a = randomUUID()
        const moved = db.prepare(`SELECT id, language, value FROM translations WHERE meaningId = ?`).all(M_LEADER_TEXT) as { id: number; language: string; value: string | null }[]
        for (const language of new Set(moved.map((t) => t.language))) {
            const old = db.prepare(`SELECT value FROM translations WHERE meaningId = ? AND language = ?`).all(M_WATER, language) as { value: string | null }[]
            db.prepare(`DELETE FROM translations WHERE meaningId = ? AND language = ?`).run(M_WATER, language)
            const fresh = moved.filter((t) => t.language === language).map((t) => t.value).join(" | ")
            if (old.map((t) => t.value).join(" | ") !== fresh) audit(a, VODA, `${language}.value`, old.map((t) => t.value).join(" | ") || null, fresh)
        }
        db.prepare(`UPDATE translations SET meaningId = ? WHERE meaningId = ?`).run(M_WATER, M_LEADER_TEXT)
        db.prepare(`UPDATE OR IGNORE semantic_relations SET sourceId = ? WHERE sourceId = ?`).run(M_WATER, M_LEADER_TEXT)
        db.prepare(`UPDATE OR IGNORE semantic_relations SET targetId = ? WHERE targetId = ?`).run(M_WATER, M_LEADER_TEXT)
        db.prepare(`DELETE FROM semantic_relations WHERE sourceId = targetId`).run()
        db.prepare(`INSERT OR IGNORE INTO meanings_synsets (meaningId, synsetId) SELECT ?, synsetId FROM meanings_synsets WHERE meaningId = ?`).run(M_WATER, M_LEADER_TEXT)
        db.prepare(`DELETE FROM meanings WHERE id = ?`).run(M_LEADER_TEXT) // cascade: leftover relations/synset links
        audit(a, VODA, "meaning.22558", leaderText.meaning, null)
        db.prepare(`UPDATE lexemes SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(VODA)
    }
    const homonym = db.prepare(`SELECT id, wordIds FROM base_homonyms WHERE base = 'vođ'`).get() as { id: number; wordIds: string } | undefined
    if (homonym) {
        const ids = (JSON.parse(homonym.wordIds) as (number | { id: number })[]).filter((entry) => (typeof entry === "number" ? entry : entry.id) !== VODA)
        db.prepare(`UPDATE base_homonyms SET wordIds = ? WHERE id = ?`).run(JSON.stringify(ids), homonym.id)
    }

    // --- B. vođa: leader --------------------------------------------------
    {
        const a = randomUUID()
        const before = db.prepare(`SELECT value, protoStemClass, paradigm FROM lexemes WHERE id = ?`).get(VODJA) as { value: string; protoStemClass: string | null; paradigm: string | null }
        const after = { value: "vođa", protoStemClass: "jā", paradigm: "A" }
        for (const [field, next] of Object.entries(after)) {
            if (before[field as keyof typeof before] === next) continue
            db.prepare(`UPDATE lexemes SET ${field} = ? WHERE id = ?`).run(next, VODJA)
            audit(a, VODJA, field, before[field as keyof typeof before], next)
        }
        setAllophone(a, VODJA, "CORE", "vođa"); setAllophone(a, VODJA, "WEST", "vođa")
        setAllophone(a, VODJA, "EAST", "воđа"); setAllophone(a, VODJA, "SOUTH", "воđа")
        if (leaderText) {
            const current = db.prepare(`SELECT meaning, examples FROM meanings WHERE id = ?`).get(M_LEADER) as { meaning: string | null; examples: string | null }
            db.prepare(`UPDATE meanings SET meaning = ?, examples = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(leaderText.meaning, leaderText.examples, M_LEADER)
            audit(a, VODJA, "meaning.22586", current.meaning, leaderText.meaning)
        }
        db.prepare(`UPDATE lexemes SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(VODJA)
    }

    // --- C. vođica: reins --------------------------------------------------
    if (reinMeaning && reinMeaning.lexemeId === VODA) {
        const a = randomUUID()
        let lexemeId = (db.prepare(`SELECT id FROM lexemes WHERE value = 'vođica'`).get() as { id: number } | undefined)?.id
        if (!lexemeId) {
            const slug = db.prepare(`SELECT 1 FROM lexemes WHERE slug = 'vođica-NOUN'`).get() ? "vođica-NOUN-2" : "vođica-NOUN"
            lexemeId = Number(db.prepare(`
                INSERT INTO lexemes (slug, value, stem, pos, gender, usageType, protoStemClass, paradigm, declension, isPublic, createdAt, updatedAt)
                VALUES (?, 'vođica', 'vođic', 'NOUN', 'Fem', 'general', 'jā', 'A', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(slug).lastInsertRowid)
            for (const [field, value] of Object.entries({ value: "vođica", stem: "vođic", pos: "NOUN", gender: "Fem", protoStemClass: "jā", paradigm: "A" })) audit(a, lexemeId, field, null, value)
            setAllophone(a, lexemeId, "CORE", "vođica"); setAllophone(a, lexemeId, "WEST", "vođica")
            setAllophone(a, lexemeId, "EAST", "воđица"); setAllophone(a, lexemeId, "SOUTH", "воđица")
            db.prepare(`INSERT INTO base_homonyms (base, wordIds) VALUES ('vođic', ?)`).run(JSON.stringify([lexemeId]))
        }
        db.prepare(`UPDATE meanings SET lexemeId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(lexemeId, M_REIN)
        audit(a, VODA, "meaning.22587", "rein translations", `moved to lexeme ${lexemeId} (vođica)`)
        audit(a, lexemeId, "meaning.22587", null, "rein translations moved from voda")
        console.log(`vođica lexeme id: ${lexemeId}`)
    }
})()
console.log("Done.")
