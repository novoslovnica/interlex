// Применение файла правок по дублям-лексемам (duplicates-field-edits.json),
// собранного из размеченного мейнтейнером duplicates-review.md.
//
// Операции файла:
//   merge         — слить source в target: значения переносятся (если не указан
//                   dropSourceMeanings), частотность суммируется на цель ДО
//                   удаления источника, ссылки во всех таблицах перевязываются,
//                   пишется AuditLog, источник удаляется;
//   rename-slug   — переименовать слаг лексемы в <value>-<POS> (коллизия -> -2,
//                   -3, ...) и перевязать ссылки в corpus.db;
//   keep / needs-decision — не трогаем, печатаем.
//
// Опции merge (подтверждены мейнтейнером 2026-10-14/15):
//   dropSourceMeanings  — значения источника НЕ переносить, а удалить
//                         (переводы ошибочны либо дублируют цель);
//   allophone           — заменить значение в существующем CORE-аллофоне цели;
//   stem / protoStemClass / stemExtension — правки полей выжившей лексемы
//                         (например žrebę-n: consonant + ent + стем žrěbę);
//   renameTargetToValuePos — после слияния привести ключ цели к <value>-<POS>.
//
// PRAGMA foreign_keys = ON: пропущенная таблица-ссылка не даст удалить источник,
// это страховка от неполной перевязки.
//
// Usage:
//   npx tsx scripts/db/2026-10-14-merge-safe-homonym-duplicates.ts [--plan=FILE]           # dry run
//   npx tsx scripts/db/2026-10-14-merge-safe-homonym-duplicates.ts [--plan=FILE] --apply

import fs from "fs"
import path from "path"
import Database from "better-sqlite3"
import { randomUUID } from "crypto"
import { rewireCommentsLexeme } from "@/lib/community/comments"

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
const CORPUS_PATH = process.env.CORPUS_SQLITE_DB || process.env.CORPUS_DB || path.resolve(process.cwd(), "corpus.db")
const APPLY = process.argv.includes("--apply")
const AUTHOR = "script:merge-safe-homonym-duplicates"
const PLAN_PATH = process.argv.find((a) => a.startsWith("--plan="))?.slice("--plan=".length)
    ?? path.resolve(process.cwd(), "duplicates-field-edits.json")

interface Lex {
    id: number; slug: string; value: string | null; stem: string | null; pos: string | null
    gender: string | null; corpusFrequency: number | null; corpusFrequencyPerMln: number | null
    protoStemClass: string | null; stemExtension: string | null
}

interface MergeOp {
    op: "merge"
    source: string
    target: string
    tokens?: number
    stem?: string
    protoStemClass?: string
    stemExtension?: string
    allophone?: string
    dropSourceMeanings?: boolean
    renameTargetToValuePos?: boolean
    notes?: string
}
interface RenameOp { op: "rename-slug"; slug: string; reason?: string }
type OtherOp = { op: "keep" | "needs-decision"; slugs?: string[]; notes?: string }

function loadOps(): { merges: MergeOp[]; renames: RenameOp[]; others: OtherOp[] } {
    if (!fs.existsSync(PLAN_PATH)) {
        console.error(`Файл правок не найден: ${PLAN_PATH}`)
        process.exit(2)
    }
    const doc = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8")) as { ops: Array<MergeOp | RenameOp | OtherOp> }
    return {
        merges: doc.ops.filter((o): o is MergeOp => o.op === "merge" && !!o.source && !!o.target),
        renames: doc.ops.filter((o): o is RenameOp => o.op === "rename-slug" && !!o.slug),
        others: doc.ops.filter((o): o is OtherOp => o.op === "keep" || o.op === "needs-decision"),
    }
}

const { merges, renames, others } = loadOps()

const db = new Database(DB_PATH)
db.pragma("foreign_keys = ON")

const tables = new Set(
    (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map((r) => r.name),
)
const absentTables = new Set<string>()

const lexOf = (slug: string) => db.prepare(`SELECT id, slug, value, stem, pos, gender, corpusFrequency, corpusFrequencyPerMln,
    protoStemClass, stemExtension FROM lexemes WHERE slug = ?`).get(slug) as Lex | undefined

console.log(`interlex: ${DB_PATH}`)
console.log(`corpus:   ${CORPUS_PATH}`)
console.log(`План:     ${PLAN_PATH}`)
console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`)
console.log(`Операций: merge ${merges.length}, rename-slug ${renames.length}, прочих ${others.length}\n`)

const meaningIdsOf = (id: number) => (db.prepare(`SELECT id FROM meanings WHERE lexemeId = ? ORDER BY id`).all(id) as { id: number }[]).map((r) => r.id)

function audit(entityId: number, field: string, oldValue: unknown, newValue: unknown) {
    db.prepare(`INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail, createdAt)
        VALUES (?, 'Lexeme', ?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)`).run(
        randomUUID(), entityId, field,
        oldValue === null || oldValue === undefined ? null : String(oldValue),
        newValue === null || newValue === undefined ? null : String(newValue),
        AUTHOR,
    )
}

type BaseHomonymEntry = number | { id: number; flavor?: string }
function moveBaseHomonyms(sourceId: number, targetId: number) {
    for (const h of db.prepare(`SELECT id, wordIds FROM base_homonyms`).all() as { id: number; wordIds: string }[]) {
        const entries = JSON.parse(h.wordIds) as BaseHomonymEntry[]
        const idOf = (e: BaseHomonymEntry) => (typeof e === "number" ? e : e.id)
        if (!entries.some((e) => idOf(e) === sourceId)) continue
        const hasTarget = entries.some((e) => idOf(e) === targetId)
        const next = entries.flatMap((e): BaseHomonymEntry[] =>
            idOf(e) !== sourceId ? [e] : hasTarget ? [] : [typeof e === "number" ? targetId : { ...e, id: targetId }])
        if (next.length === 0) db.prepare(`DELETE FROM base_homonyms WHERE id = ?`).run(h.id)
        else db.prepare(`UPDATE base_homonyms SET wordIds = ? WHERE id = ?`).run(JSON.stringify(next), h.id)
    }
}

// Новый слаг по правилу <value>-<POS>, при занятом ключе -2, -3 ... (как
// lib/slug.ts::generateUniqueSlug). Дополнительно уважает ключи, которые уже
// назначены в этом же прогоне (иначе две операции могут выбрать один слаг).
function planNewSlug(lex: Lex, taken: Set<string>): string {
    const base = `${String(lex.value ?? lex.slug).toLowerCase()}-${String(lex.pos ?? "unknown").trim()}`
    if (!taken.has(base)) return base
    let n = 2
    for (;;) {
        const candidate = `${base}-${n}`
        if (!taken.has(candidate)) return candidate
        n++
    }
}

const now = new Date().toISOString().replace("Z", "+00:00")
const redirects = new Map<string, string>()
const renamePlan: Array<{ lex: Lex; newSlug: string }> = []
const warnings: string[] = []
const applied: string[] = []

// ---- 1. Разбор операций (без записи) ---------------------------------------
const mergePlans: Array<{ op: MergeOp; source: Lex; target: Lex }> = []
for (const op of merges) {
    const source = lexOf(op.source)
    const target = lexOf(op.target)
    if (!source || !target) {
        warnings.push(`${op.source} -> ${op.target}: пропуск (источник ${source ? "есть" : "нет"}, цель ${target ? "есть" : "нет"})`)
        continue
    }
    // Часть речи и род в файле правок — решение мейнтейнера, поэтому это не
    // блокировка, а предупреждение: расхождение видно в отчёте.
    if ((source.pos ?? "") !== (target.pos ?? "")) warnings.push(`${op.source} -> ${op.target}: POS расходится (${source.pos} vs ${target.pos})`)
    if ((source.gender ?? "") !== (target.gender ?? "")) warnings.push(`${op.source} -> ${op.target}: род расходится (${source.gender} vs ${target.gender})`)
    mergePlans.push({ op, source, target })
    redirects.set(source.slug, target.slug)
}

const taken = new Set((db.prepare(`SELECT slug FROM lexemes`).all() as { slug: string }[]).map((r) => r.slug))
for (const op of renames) {
    const lex = lexOf(op.slug)
    if (!lex) { warnings.push(`rename ${op.slug}: лексемы нет (уже переименована?)`); continue }
    const newSlug = planNewSlug(lex, taken)
    if (newSlug === lex.slug) { warnings.push(`rename ${lex.slug}: уже соответствует правилу`); continue }
    taken.add(newSlug)
    taken.delete(lex.slug)
    renamePlan.push({ lex, newSlug })
    redirects.set(lex.slug, newSlug)
}

// Замыкаем цепочки переименований (цель слияния сама может переименовываться).
const resolveFinal = (slug: string): string => {
    let cur = slug
    for (let i = 0; i < 10; i++) {
        const next = redirects.get(cur)
        if (!next || next === cur) break
        cur = next
    }
    return cur
}

console.log(`Слияний к применению: ${mergePlans.length}`)
for (const { op, source, target } of mergePlans) {
    const extras = [
        op.dropSourceMeanings ? "значения источника удалить" : "значения перенести",
        op.allophone ? `аллофон→${op.allophone}` : "",
        op.stem ? `stem→${op.stem}` : "",
        op.protoStemClass ? `класс→${op.protoStemClass}` : "",
        op.stemExtension ? `наращение→${op.stemExtension}` : "",
        op.renameTargetToValuePos ? "ключ цели к <value>-<POS>" : "",
    ].filter(Boolean).join("; ")
    console.log(`  ${source.slug} -> ${target.slug}  [${extras}]`)
}
console.log(`\nПереименований слага: ${renamePlan.length}`)
for (const r of renamePlan) console.log(`  ${r.lex.slug} -> ${r.newSlug}`)
if (warnings.length > 0) {
    console.log(`\nПредупреждения (${warnings.length}):`)
    for (const w of warnings) console.log(`  ${w}`)
}
console.log()

// ---- 2. Запись -------------------------------------------------------------
const run = db.transaction(() => {
    const freq = new Map<number, { abs: number; mln: number; was: number }>()
    for (const { source, target } of mergePlans) {
        const acc = freq.get(target.id) ?? {
            abs: target.corpusFrequency ?? 0,
            mln: target.corpusFrequencyPerMln ?? 0,
            was: target.corpusFrequencyPerMln ?? 0,
        }
        acc.abs += source.corpusFrequency ?? 0
        acc.mln += source.corpusFrequencyPerMln ?? 0
        freq.set(target.id, acc)
    }

    for (const { op, source, target } of mergePlans) {
        const ids = meaningIdsOf(source.id)
        if (APPLY) {
            if (op.dropSourceMeanings) {
                for (const m of ids) db.prepare(`DELETE FROM meanings WHERE id = ?`).run(m)
            } else {
                for (const m of ids) db.prepare(`UPDATE meanings SET lexemeId = ? WHERE id = ?`).run(target.id, m)
            }

            db.prepare(`UPDATE lexemes_morphemes SET lexemeId = ? WHERE lexemeId = ?`).run(target.id, source.id)
            db.prepare(`DELETE FROM lexemes_morphemes WHERE lexemeId = ? AND id NOT IN (SELECT MIN(id) FROM lexemes_morphemes WHERE lexemeId = ? GROUP BY morphemeId)`).run(target.id, target.id)

            db.prepare(`UPDATE inflection_anomalies SET lexemeId = ? WHERE lexemeId = ?`).run(target.id, source.id)
            db.prepare(`DELETE FROM inflection_anomalies WHERE lexemeId = ? AND id NOT IN (SELECT MIN(id) FROM inflection_anomalies WHERE lexemeId = ? GROUP BY inflection, grammeme)`).run(target.id, target.id)

            db.prepare(`UPDATE OR IGNORE lexeme_allophones SET lexemeId = ? WHERE lexemeId = ?`).run(target.id, source.id)
            db.prepare(`DELETE FROM lexeme_allophones WHERE lexemeId = ?`).run(source.id)

            if (tables.has("proper_noun_signals")) {
                const has = db.prepare(`SELECT 1 FROM proper_noun_signals WHERE lexemeId = ? LIMIT 1`).get(target.id)
                if (has) db.prepare(`DELETE FROM proper_noun_signals WHERE lexemeId = ?`).run(source.id)
                else db.prepare(`UPDATE proper_noun_signals SET lexemeId = ? WHERE lexemeId = ?`).run(target.id, source.id)
            } else absentTables.add("proper_noun_signals")

            if (tables.has("valency_arguments")) {
                db.prepare(`UPDATE valency_arguments SET prepositionLexemeId = ? WHERE prepositionLexemeId = ?`).run(target.id, source.id)
            } else absentTables.add("valency_arguments")

            db.prepare(`UPDATE content_reports SET lexemeId = ? WHERE lexemeId = ?`).run(target.id, source.id)
            db.prepare(`UPDATE content_reports SET entityId = ? WHERE entityType = 'Lexeme' AND entityId = ?`).run(target.id, source.id)

            moveBaseHomonyms(source.id, target.id)
            if (tables.has("word_comments")) rewireCommentsLexeme(db, { fromLexemeId: source.id, toLexemeId: target.id })
            else absentTables.add("word_comments")

            audit(target.id, "mergedFrom", null, `${source.id} ${source.slug}`)
            db.prepare(`DELETE FROM lexemes WHERE id = ?`).run(source.id)

            // Правки полей выжившей лексемы.
            if (op.stem !== undefined) {
                const old = target.stem
                db.prepare(`UPDATE lexemes SET stem = ?, updatedAt = ? WHERE id = ?`).run(op.stem, now, target.id)
                audit(target.id, "stem", old, op.stem)
            }
            if (op.protoStemClass !== undefined) {
                db.prepare(`UPDATE lexemes SET protoStemClass = ?, updatedAt = ? WHERE id = ?`).run(op.protoStemClass, now, target.id)
                audit(target.id, "protoStemClass", target.protoStemClass, op.protoStemClass)
            }
            if (op.stemExtension !== undefined) {
                db.prepare(`UPDATE lexemes SET stemExtension = ?, updatedAt = ? WHERE id = ?`).run(op.stemExtension, now, target.id)
                audit(target.id, "stemExtension", target.stemExtension, op.stemExtension)
            }
            if (op.allophone !== undefined) {
                // Замена значения в СУЩЕСТВУЮЩЕМ CORE-аллофоне (решение мейнтейнера).
                const core = db.prepare(`SELECT la.id, la.value, la.type FROM lexeme_allophones la
                    JOIN allophone_flavors f ON f.id = la.flavorId
                    WHERE la.lexemeId = ? AND f.code = 'CORE' LIMIT 1`).get(target.id) as { id: number; value: string; type: string } | undefined
                if (!core) {
                    warnings.push(`${target.slug}: CORE-аллофон не найден, правка allophone не применена`)
                } else if (core.value !== op.allophone) {
                    db.prepare(`UPDATE lexeme_allophones SET value = ? WHERE id = ?`).run(op.allophone, core.id)
                    audit(target.id, `allophone.${core.type}`, core.value, op.allophone)
                }
            }
        }
        applied.push(`${source.slug} -> ${target.slug} (${ids.length} зн. ${op.dropSourceMeanings ? "удалено" : "перенесено"})`)
    }

    // Переименования слагов.
    for (const { lex, newSlug } of renamePlan) {
        if (!APPLY) { applied.push(`${lex.slug} -> ${newSlug}`); continue }
        db.prepare(`UPDATE lexemes SET slug = ?, updatedAt = ? WHERE id = ?`).run(newSlug, now, lex.id)
        audit(lex.id, "slug", lex.slug, newSlug)
        applied.push(`${lex.slug} -> ${newSlug}`)
    }

    if (APPLY) {
        for (const [id, f] of freq) {
            db.prepare(`UPDATE lexemes SET corpusFrequency = ?, corpusFrequencyPerMln = ?, updatedAt = ? WHERE id = ?`)
                .run(f.abs, f.mln, now, id)
            audit(id, "corpusFrequencyPerMln", f.was.toFixed(1), f.mln.toFixed(1))
        }
    }
})

if (APPLY) {
    const backup = `${DB_PATH}.backup-before-field-edits`
    if (!fs.existsSync(backup)) { fs.copyFileSync(DB_PATH, backup); console.log(`backup: ${backup}\n`) }
}

run()
db.close()

for (const line of applied) console.log(`  ${line}`)
if (absentTables.size > 0) console.log(`\nПропущены отсутствующие в базе таблицы: ${[...absentTables].join(", ")}`)

if (!APPLY) {
    console.log("\nDry run only — re-run with --apply.")
    process.exit(0)
}

// ---- 3. corpus.db ----------------------------------------------------------
// Перевязываем ссылки по итоговым слагам (слияния + переименования, цепочки
// разрешены). Ключи групп омонимов, чей набор кандидатов изменился, снимаем —
// они вернутся в очередь после ближайшей переразметки.
const corpus = new Database(CORPUS_PATH)
corpus.pragma("foreign_keys = ON")

const froms = [...redirects.keys()]
const finals = froms.map((f) => resolveFinal(f))
const marks = froms.map(() => "?").join(",")

const repoint = corpus.transaction(() => {
    corpus.prepare(`CREATE TEMP TABLE affected_tokens AS
        SELECT DISTINCT tokenId FROM CorpusTokenCandidate WHERE wordSlug IN (${marks})`).run(...froms)
    const keysCleared = corpus.prepare(`UPDATE CorpusToken SET homonymGroupKey = NULL
        WHERE homonymGroupKey IS NOT NULL AND id IN (SELECT tokenId FROM affected_tokens)`).run().changes

    const caseExpr = froms.map(() => "WHEN ? THEN ?").join(" ")
    const caseParams = froms.flatMap((f, i) => [f, finals[i]])
    const candidates = corpus.prepare(`UPDATE CorpusTokenCandidate
        SET wordSlug = CASE wordSlug ${caseExpr} ELSE wordSlug END
        WHERE wordSlug IN (${marks})`).run(...caseParams, ...froms).changes

    let tokens = 0
    for (let i = 0; i < froms.length; i++) {
        const from = froms[i]
        const to = finals[i]
        if (from === to) continue
        tokens += corpus.prepare(`UPDATE CorpusToken SET wordSlug = ?, lemma = CASE WHEN lemma = ? THEN ? ELSE lemma END WHERE wordSlug = ?`).run(to, from, to, from).changes
        corpus.prepare(`UPDATE CorpusCandidateProposal SET siblingWordSlug = ? WHERE siblingWordSlug = ?`).run(to, from)
    }

    corpus.exec(`DROP TABLE affected_tokens`)
    console.log(`corpus: ${tokens} токенов перенаправлено, ${candidates} кандидатов, ${keysCleared} ключей групп снято`)
})
repoint()
corpus.close()
