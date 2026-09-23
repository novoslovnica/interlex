// Brings the moderation done on production since the databases diverged
// (about 2026-07-20) into the local interlex.db, so that the local snapshot
// (September merges, capitalization pass, voda split, community tables) can
// replace the production file without losing that work.
//
// Input: a directory with JSON files exported from production by read-only
// better-sqlite3 scripts: lexemes_touched.json (all lexemes), candidates.json,
// root_discovery_reviewed.json, and prod-export4.json (full translations,
// meanings, lexeme_allophones, base_homonyms, lexemes_morphemes,
// inflection_anomalies, human audit rows).
//
// Facts established while writing this (see AGENTS.md for the story):
//   - meaning ids match between the two databases (checked by text); a few
//     sit on another lexeme locally because the September merges moved
//     them - harmless, translations key by meaningId;
//   - translation ids do NOT match (the table was rebuilt at different
//     times) -> translations are matched by (meaningId, language) and, when
//     several rows share a language, by the old value the moderator saw
//     (audit oldValue), case-insensitively (the local pass lowercased);
//   - production holds ~7 300 non-empty rows of the 2026-07-13 import that
//     the local 07-23/24 consolidation lost (abhazsky: en/ru/... on
//     production, nothing locally). Where the local database has NO row for
//     that (meaning, language) the production row is imported as a gap
//     fill (6 350 rows, 1 491 meanings); where it has a DIFFERENT value the
//     pair is written to prod-translation-disagreements.json for the
//     maintainer (699 rows: synonyms like «Лысый»/«безволосый», but also
//     local misattachments like «Информация»/«данник») and left alone;
//   - lexeme_allophones ids match; an allophone value is taken from
//     production only where the local value has no local audit trail
//     (local scripts rewrote voda/vođa etc. on purpose);
//   - candidates and root_discovery_proposals ids differ (staging tables):
//     candidates are replaced by production's, root decisions matched by
//     (clusterKey, method);
//   - lexeme 25508 "značenje" was promoted from a candidate on production
//     and is inserted as is (likely a duplicate of 22199 znacenje-NOUN, left
//     for /admin/deduplication - parity first); the production merge
//     7038 drugy-NUM -> 566 drugy-adj is replayed with lib/dedup/mergeLexemes.
// The production audit rows are copied (same actionId/userEmail/createdAt),
// so the moderators' history survives on the word pages. Idempotent. Dry
// run by default (writes inside a transaction that is rolled back).
//
// Usage: npx tsx scripts/db/2026-09-23-import-prod-moderation.ts <export-dir> [--apply]

import Database from "better-sqlite3"
import fs from "fs"
import path from "path"
import { mergeLexemes } from "../../lib/dedup/mergeLexemes"

const [exportDir, ...flags] = process.argv.slice(2)
if (!exportDir) throw new Error("export dir required")
const APPLY = flags.includes("--apply")
const HUMAN_WINDOW_START = "2026-07-20"
const read = <T>(name: string): T[] => JSON.parse(fs.readFileSync(path.join(exportDir, `${name}.json`), "utf8"))
// Открывается на запись и в сухом прогоне: изменения делаются в транзакции и откатываются.
const db = new Database(process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db"))

type Row = Record<string, string | number | null>
interface AuditRow { actionId: string; entityType: string; entityId: number; field: string; oldValue: string | null; newValue: string | null; userId: string | null; userEmail: string; createdAt: string }
interface TrRow { meaningId: number; language: string; value: string | null; verified: number | null; message: string | null; createdAt: string; updatedAt: string }
interface AlloRow { id: number; lexemeId: number; code: string; type: string; value: string; verified: number | null }

const full = JSON.parse(fs.readFileSync(path.join(exportDir, "prod-export4.json"), "utf8")) as {
    translations: TrRow[]; allophones: AlloRow[]; homonyms: Row[]; lexemesMorphemes: Row[]; inflectionAnomalies: Row[]; auditAll: AuditRow[]
}
const lexemesProd = new Map(read<Row>("lexemes_touched").map((l) => [l.id as number, l]))
const candidates = read<Row>("candidates"), roots = read<Row>("root_discovery_reviewed")
const audit = full.auditAll
const lower = (v: string | null | undefined) => (v ?? "").trim().toLowerCase()
const meaningLexeme = new Map((db.prepare(`select id, lexemeId from meanings`).all() as { id: number; lexemeId: number }[]).map((m) => [m.id, m.lexemeId]))
const flavorId = Object.fromEntries((db.prepare(`select id, code from allophone_flavors`).all() as { id: number; code: string }[]).map((f) => [f.code, f.id]))
const log: string[] = []
const counts: Record<string, number> = {}
const bump = (key: string) => { counts[key] = (counts[key] ?? 0) + 1 }
const lexemeExists = (id: number) => Boolean(db.prepare(`select 1 from lexemes where id = ?`).get(id))
// локальный аудит по (lexeme, field) после начала окна - признак осознанной локальной правки
const localTouched = new Set((db.prepare(`select entityId || '|' || field k from audit_logs where createdAt > ?`).all(HUMAN_WINDOW_START) as { k: string }[]).map((r) => r.k))
const localAlloTouched = new Set((db.prepare(`select distinct entityId from audit_logs where field = 'isv' or field = 'nsl' or field like 'allophone.%'`).all() as { entityId: number }[]).map((r) => r.entityId))

const run = db.transaction(() => {
    // --- 1. translations inside the human window, by (meaningId, language) --
    const localRows = db.prepare(`select id, value, verified, message from translations where meaningId = ? and language = ? order by id`)
    const consumed = new Set<number>()
    const window = full.translations.filter((t) => t.createdAt > HUMAN_WINDOW_START || t.updatedAt > HUMAN_WINDOW_START)
    for (const t of window) {
        if (lower(t.value) === "") continue
        if (!meaningLexeme.has(t.meaningId)) { bump("translation.meaningMissing"); log.push(`SKIP meaning ${t.meaningId} missing: ${t.language}=${t.value}`); continue }
        // Старые значения из прод-аудита по этому языку - чтобы узнать локальную
        // строку, которую модератор переписал (сопоставление без учёта регистра).
        const oldValues = audit.filter((a) => a.field === `${t.language}.value`).map((a) => lower(a.oldValue))
        const locals = (localRows.all(t.meaningId, t.language) as { id: number; value: string | null; verified: number | null; message: string | null }[]).filter((l) => !consumed.has(l.id))
        const sameText = locals.find((l) => lower(l.value) === lower(t.value))
        const match = sameText ?? (locals.length === 1 && oldValues.includes(lower(locals[0].value)) ? locals[0] : undefined)
        if (match) {
            consumed.add(match.id)
            // Локальная отметка verified=1 не снимается прод-значением 0/NULL: она могла появиться локально позже.
            const verified = t.verified === 1 ? 1 : match.verified
            // Разница только в регистре: локальная нормализация опускала первую
            // букву, прод-заливка её держит - берём вариант со строчной, а не прод.
            const firstIsLower = (v: string | null) => { const ch = (v ?? "").trim()[0]; return !!ch && ch === ch.toLowerCase() }
            const value = sameText ? (firstIsLower(match.value) || !firstIsLower(t.value) ? match.value : t.value) : t.value
            if (match.value === value && (match.verified ?? null) === (verified ?? null) && (match.message ?? null) === (t.message ?? null)) { bump("translation.same"); continue }
            db.prepare(`update translations set value = ?, verified = ?, message = ?, updatedAt = ? where id = ?`).run(value, verified, t.message, t.updatedAt, match.id)
            bump(match.value === value ? "translation.flagUpdated" : "translation.valueUpdated")
            if (match.value !== value) log.push(`UPDATE meaning ${t.meaningId} ${t.language}: "${match.value}" -> "${value}" (v=${verified})`)
        } else {
            db.prepare(`insert into translations (meaningId, language, value, verified, message, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?, ?)`)
                .run(t.meaningId, t.language, t.value, t.verified, t.message, t.createdAt, t.updatedAt)
            bump("translation.inserted")
            if (locals.length) log.push(`INSERT beside existing: meaning ${t.meaningId} ${t.language} "${t.value}" (local had ${locals.map((l) => `"${l.value}"`).join(",")})`)
        }
    }

    // --- 1b. gap fill: production rows of the July import that the local
    // consolidation lost, only where the local meaning has no row in that
    // language at all; disagreements go to a report, not into the DB --------
    const disagreements: { meaningId: number; language: string; prod: string; prodVerified: number | null; local: (string | null)[] }[] = []
    const inserted = new Set<string>()
    for (const t of full.translations) {
        if (lower(t.value) === "" || !meaningLexeme.has(t.meaningId)) continue
        if (t.createdAt > HUMAN_WINDOW_START || t.updatedAt > HUMAN_WINDOW_START) continue // уже обработано выше
        const key = `${t.meaningId}|${t.language}`
        const locals = localRows.all(t.meaningId, t.language) as { id: number; value: string | null }[]
        if (locals.some((l) => lower(l.value) === lower(t.value))) continue
        if (locals.length > 0 || inserted.has(key)) {
            if (locals.length > 0) disagreements.push({ meaningId: t.meaningId, language: t.language, prod: t.value ?? "", prodVerified: t.verified, local: locals.map((l) => l.value) })
            continue
        }
        db.prepare(`insert into translations (meaningId, language, value, verified, message, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?, ?)`)
            .run(t.meaningId, t.language, t.value, t.verified, t.message, t.createdAt, t.updatedAt)
        inserted.add(key); bump("translation.gapFilled")
    }
    fs.writeFileSync(path.resolve(process.cwd(), "prod-translation-disagreements.json"), JSON.stringify(disagreements, null, 1))
    counts["translation.disagreementsReported"] = disagreements.length

    // --- 2. allophones: verified flags always; values only where local has no audit trail --
    const touchedLexemes = new Set<number>()
    for (const a of full.allophones) {
        if (!lexemeExists(a.lexemeId) || !flavorId[a.code]) continue
        // Сначала по (лексема, флавор, тип): id совпадают не для всех строк.
        const local = (db.prepare(`select id, value, verified from lexeme_allophones where lexemeId = ? and flavorId = ? and type = ?`).get(a.lexemeId, flavorId[a.code], a.type)
            ?? db.prepare(`select id, value, verified from lexeme_allophones where id = ? and lexemeId = ?`).get(a.id, a.lexemeId)) as { id: number; value: string; verified: number | null } | undefined
        if (!local) {
            db.prepare(`insert into lexeme_allophones (lexemeId, flavorId, type, value, verified) values (?, ?, ?, ?, ?)`).run(a.lexemeId, flavorId[a.code], a.type, a.value, a.verified)
            bump("allophone.inserted"); log.push(`ALLOPHONE inserted ${a.code} lexeme ${a.lexemeId} "${a.value}"`); touchedLexemes.add(a.lexemeId); continue
        }
        const takeValue = local.value !== a.value && !localAlloTouched.has(a.lexemeId)
        const takeVerified = a.verified !== null && local.verified !== a.verified
        if (!takeValue && !takeVerified) continue
        db.prepare(`update lexeme_allophones set value = ?, verified = ? where id = ?`).run(takeValue ? a.value : local.value, takeVerified ? a.verified : local.verified, local.id)
        bump(takeValue ? "allophone.valueUpdated" : "allophone.flagUpdated")
        if (takeValue) log.push(`ALLOPHONE ${a.code} lexeme ${a.lexemeId}: "${local.value}" -> "${a.value}"`)
        touchedLexemes.add(a.lexemeId)
    }

    // --- 3. lexeme fields edited by hand on production ---------------------
    const lexemeColumns = new Set((db.prepare(`PRAGMA table_info(lexemes)`).all() as { name: string }[]).map((c) => c.name))
    for (const a of audit) {
        if (a.entityType !== "Lexeme" || !lexemeColumns.has(a.field) || a.field === "isPublic") continue
        const prod = lexemesProd.get(a.entityId)
        const local = db.prepare(`select * from lexemes where id = ?`).get(a.entityId) as Row | undefined
        if (!prod || !local) continue
        if ((local[a.field] ?? null) === (prod[a.field] ?? null)) continue
        if (localTouched.has(`${a.entityId}|${a.field}`)) { bump("lexeme.fieldLocallyChanged"); log.push(`KEEP lexeme ${a.entityId}.${a.field}: local "${local[a.field]}" (local edit) vs prod "${prod[a.field]}"`); continue }
        db.prepare(`update lexemes set ${a.field} = ? where id = ?`).run(prod[a.field], a.entityId)
        bump("lexeme.fieldUpdated"); log.push(`LEXEME ${a.entityId}.${a.field}: "${local[a.field]}" -> "${prod[a.field]}"`); touchedLexemes.add(a.entityId)
    }

    // --- 4. base_homonyms rows that production edits created ---------------
    for (const h of full.homonyms) {
        if (db.prepare(`select 1 from base_homonyms where base = ?`).get(h.base)) continue
        const ids = (JSON.parse(h.wordIds as string) as (number | { id: number })[]).map((e) => (typeof e === "number" ? e : e.id))
        if (!ids.every(lexemeExists)) continue
        db.prepare(`insert into base_homonyms (base, wordIds) values (?, ?)`).run(h.base, h.wordIds); bump("homonym.inserted")
    }

    // --- 5. morpheme links and inflection anomalies ------------------------
    for (const r of full.lexemesMorphemes) {
        if (!lexemeExists(r.lexemeId as number) || !db.prepare(`select 1 from morphemes where id = ?`).get(r.morphemeId)) continue
        if (db.prepare(`select 1 from lexemes_morphemes where lexemeId = ? and morphemeId = ?`).get(r.lexemeId, r.morphemeId)) continue
        db.prepare(`insert into lexemes_morphemes (lexemeId, morphemeId) values (?, ?)`).run(r.lexemeId, r.morphemeId); bump("morphemeLink.inserted")
    }
    for (const r of full.inflectionAnomalies) {
        if (!lexemeExists(r.lexemeId as number)) continue
        if (db.prepare(`select 1 from inflection_anomalies where lexemeId = ? and inflection = ? and grammeme = ?`).get(r.lexemeId, r.inflection, r.grammeme)) continue
        db.prepare(`insert into inflection_anomalies (lexemeId, inflection, grammeme) values (?, ?, ?)`).run(r.lexemeId, r.inflection, r.grammeme); bump("anomaly.inserted")
    }

    // --- 6. candidates: production is the source of truth ------------------
    db.prepare(`delete from candidates`).run()
    const candCols = Object.keys(candidates[0])
    const insertCand = db.prepare(`insert into candidates (${candCols.join(",")}) values (${candCols.map(() => "?").join(",")})`)
    for (const c of candidates) { insertCand.run(...candCols.map((k) => c[k])); bump("candidate.replaced") }

    // --- 7. lexeme promoted on production ---------------------------------
    for (const id of [25508]) {
        const prod = lexemesProd.get(id)
        if (!prod || lexemeExists(id)) { bump("lexeme.exists"); continue }
        const cols = Object.keys(prod)
        db.prepare(`insert into lexemes (${cols.join(",")}) values (${cols.map(() => "?").join(",")})`).run(...cols.map((k) => prod[k]))
        bump("lexeme.inserted"); log.push(`LEXEME inserted ${id} ${prod.slug} (likely duplicate of 22199 znacenje-NOUN)`)
    }

    // --- 8. the production merge drugy-NUM -> drugy-adj (2026-08-18) -------
    if (lexemeExists(7038) && lexemeExists(566)) {
        const merge = audit.find((a) => a.field === "mergedFrom" && a.entityId === 566)
        const isv = full.allophones.find((x) => x.lexemeId === 566 && x.code === "CORE" && x.type === "standard")?.value ?? ""
        const nsl = full.allophones.find((x) => x.lexemeId === 566 && x.code === "NSL" && x.type === "standard")?.value ?? ""
        const target = lexemesProd.get(566)!
        mergeLexemes(db, 566, 7038, { value: String(target.value), isv, nsl, usageType: String(target.usageType ?? ""), addition: String(target.addition ?? "") }, merge?.userEmail ?? "eakarpov@yandex.ru", merge?.userId ?? null)
        bump("merge.replayed"); log.push("MERGE 7038 drugy-NUM -> 566 drugy-adj replayed")
    }

    // --- 9. root discovery decisions (ids differ -> by cluster) ------------
    for (const r of roots) {
        const local = db.prepare(`select id, status from root_discovery_proposals where clusterKey = ? and method = ?`).get(r.clusterKey, r.method) as { id: number; status: string } | undefined
        if (!local) { bump("root.missing"); continue }
        if (local.status === r.status) { bump("root.same"); continue }
        const cols = Object.keys(r).filter((k) => /^(status|reviewedAt|reviewedByUserId|resolutionNote|createdMorphemeId)$/.test(k))
        db.prepare(`update root_discovery_proposals set ${cols.map((k) => `${k} = ?`).join(", ")} where id = ?`).run(...cols.map((k) => r[k]), local.id)
        bump("root.updated"); log.push(`ROOT proposal ${r.clusterKey}: ${local.status} -> ${r.status}`)
    }

    for (const id of touchedLexemes) if (lexemeExists(id)) db.prepare(`update lexemes set updatedAt = CURRENT_TIMESTAMP where id = ?`).run(id)

    // --- 10. the moderators' audit history ---------------------------------
    const merged = new Map<number, number>()
    for (const row of db.prepare(`select entityId, newValue from audit_logs where field = 'mergedFrom'`).all() as { entityId: number; newValue: string }[]) {
        const id = parseInt(row.newValue); if (id) merged.set(id, row.entityId)
    }
    const exists = db.prepare(`select 1 from audit_logs where actionId = ? and field = ?`)
    const insertAudit = db.prepare(`insert into audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail, createdAt) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    for (const a of audit) {
        if (a.createdAt <= HUMAN_WINDOW_START) continue
        let entityId = a.entityId
        if (a.entityType === "Lexeme" && !lexemeExists(entityId) && merged.has(entityId)) entityId = merged.get(entityId)!
        if (exists.get(a.actionId, a.field)) { bump("audit.same"); continue }
        insertAudit.run(a.actionId, a.entityType, entityId, a.field, a.oldValue, a.newValue, a.userId, a.userEmail, a.createdAt)
        bump("audit.inserted")
    }
    if (!APPLY) throw new Error("DRY_RUN")
})

try { run() } catch (error) { if (!(error instanceof Error && error.message === "DRY_RUN")) throw error }
console.log(APPLY ? "APPLIED" : "DRY RUN (rolled back)")
console.log(counts)
console.log(log.join("\n"))
