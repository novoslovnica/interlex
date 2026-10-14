// Слияние 7 «безопасных» пар дублей-лексем, подтверждённых мейнтейнером
// 2026-10-14 (разметка файла duplicates-review.md, все семь — `merge B->A`).
//
// Пары — только те, где value, stem, род и POS совпадают БУКВАЛЬНО: это один и
// тот же словарный вход, записанный дважды (новый формат слага с POS заглавными
// и старый со строчными). Источник — старый формат (в нём реальная частотность
// и переводы), цель — новый формат (у всех семи 0/млн, поэтому частотность
// переносится на цель ДО удаления источника — иначе следующий пересчёт
// закрепил бы проигрыш цели, п.1 в docs/history/2026-09-15-duplicate-service-lexemes.md).
//
// Механика повторяет прецедент scripts/db/2026-09-16-merge-legacy-duplicate-lexemes.ts,
// но с двумя отличиями:
//   1. Значения НЕ отбрасываются как дубликаты — все переносятся на цель
//      (у всех семи пар переводы сторон разные, терять их нельзя), поэтому
//      перевязка semantic_relations не нужна: связи ссылаются на id значений,
//      а id значений при переносе не меняются.
//   2. Дописаны таблицы, появившиеся после прецедента: proper_noun_signals,
//      valency_arguments (prepositionLexemeId), word_comments
//      (через lib/community/comments.ts::rewireCommentsLexeme), а в corpus.db —
//      ещё CorpusTokenCandidate.wordSlug и сброс устаревшего homonymGroupKey.
//
// PRAGMA foreign_keys = ON, поэтому пропущенная таблица-ссылка не даст удалить
// источник — это страховка от неполной перевязки.
//
// Usage:
//   npx tsx scripts/db/2026-10-14-merge-safe-homonym-duplicates.ts          # dry run
//   npx tsx scripts/db/2026-10-14-merge-safe-homonym-duplicates.ts --apply

import fs from "fs"
import path from "path"
import Database from "better-sqlite3"
import { randomUUID } from "crypto"
import { rewireCommentsLexeme } from "@/lib/community/comments"

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
const CORPUS_PATH = process.env.CORPUS_SQLITE_DB || process.env.CORPUS_DB || path.resolve(process.cwd(), "corpus.db")
const APPLY = process.argv.includes("--apply")
const AUTHOR = "script:merge-safe-homonym-duplicates"

// source (старый формат, POS строчными) -> target (новый формат)
const PAIRS: Array<[string, string]> = [
    ["či-conj", "ci-CCONJ"],
    ["drugy-adj", "drugy-ADJ"],
    ["blizko-adv", "blizko-ADV"],
    ["ljuty-adj", "ljuty-ADJ"],
    ["děvica-n", "devica-NOUN"],
    ["opustiti-v", "opustiti-VERB"],
    ["vlåkno-n", "vlakno-NOUN"],
]

interface Lex {
    id: number; slug: string; value: string | null; stem: string | null; pos: string | null
    gender: string | null; corpusFrequency: number | null; corpusFrequencyPerMln: number | null
}

const db = new Database(DB_PATH)
db.pragma("foreign_keys = ON")

// Какие таблицы реально есть в этой базе: часть таблиц (proper_noun_signals,
// valency_arguments, word_comments) появилась разными скриптами и на конкретной
// базе может отсутствовать — тогда и ссылок в ней нет, и валить прогон нельзя.
const tables = new Set(
    (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map((r) => r.name),
)
const absentTables = new Set<string>()

const allSlugs = [...new Set(PAIRS.flat())]
const lexOf = new Map<string, Lex>()
for (const slug of allSlugs) {
    const row = db.prepare(`SELECT id, slug, value, stem, pos, gender, corpusFrequency, corpusFrequencyPerMln
        FROM lexemes WHERE slug = ?`).get(slug) as Lex | undefined
    if (row) lexOf.set(slug, row)
}

console.log(`interlex: ${DB_PATH}`)
console.log(`corpus:   ${CORPUS_PATH}`)
console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`)

// Защита: сливаем ТОЛЬКО если пара по-прежнему SAFE. Если данные разъехались с
// анализом, пару пропускаем с громким сообщением, а не сливаем наугад.
interface Plan { source: Lex; target: Lex; reason?: string }
const plans: Plan[] = []
const skipped: string[] = []
for (const [sourceSlug, targetSlug] of PAIRS) {
    const source = lexOf.get(sourceSlug)
    const target = lexOf.get(targetSlug)
    if (!source || !target) {
        skipped.push(`${sourceSlug} -> ${targetSlug}: уже слито или нет в словаре (source=${!!source}, target=${!!target})`)
        continue
    }
    const problems: string[] = []
    if ((source.value ?? "") !== (target.value ?? "")) problems.push(`value "${source.value}" vs "${target.value}"`)
    if ((source.stem ?? "") !== (target.stem ?? "")) problems.push(`stem "${source.stem}" vs "${target.stem}"`)
    if ((source.pos ?? "") !== (target.pos ?? "")) problems.push(`pos "${source.pos}" vs "${target.pos}"`)
    if ((source.gender ?? "") !== (target.gender ?? "")) problems.push(`gender "${source.gender}" vs "${target.gender}"`)
    if (problems.length > 0) {
        skipped.push(`${sourceSlug} -> ${targetSlug}: НЕ SAFE (${problems.join("; ")})`)
        continue
    }
    plans.push({ source, target })
}

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

const now = new Date().toISOString().replace("Z", "+00:00")

console.log(`Слияний: ${plans.length}`)
for (const { source, target } of plans) {
    console.log(`  ${source.slug} [${(source.corpusFrequencyPerMln ?? 0).toFixed(1)}/млн] -> ${target.slug} [${(target.corpusFrequencyPerMln ?? 0).toFixed(1)}/млн]`)
}
if (skipped.length > 0) {
    console.log(`\nПропущено (${skipped.length}):`)
    for (const s of skipped) console.log(`  ${s}`)
}
console.log()

if (plans.length === 0) {
    // Ничего не сливаем, но фазу corpus всё равно проходим: она идемпотентна и
    // нужна, если предыдущий прогон успел слить лексемы, но не добрался до
    // ссылок в corpus.db (именно так и случилось на первом прогоне).
    console.log("Все пары уже слиты в словаре — иду перенаправлять ссылки в corpus.db.\n")
}

const run = db.transaction(() => {
    const freq = new Map<number, { abs: number; mln: number; was: number }>()
    for (const { source, target } of plans) {
        const acc = freq.get(target.id) ?? {
            abs: target.corpusFrequency ?? 0,
            mln: target.corpusFrequencyPerMln ?? 0,
            was: target.corpusFrequencyPerMln ?? 0,
        }
        acc.abs += source.corpusFrequency ?? 0
        acc.mln += source.corpusFrequencyPerMln ?? 0
        freq.set(target.id, acc)
    }

    for (const { source, target } of plans) {
        const moved = meaningIdsOf(source.id)
        if (APPLY) {
            for (const m of moved) db.prepare(`UPDATE meanings SET lexemeId = ? WHERE id = ?`).run(target.id, m)

            db.prepare(`UPDATE lexemes_morphemes SET lexemeId = ? WHERE lexemeId = ?`).run(target.id, source.id)
            db.prepare(`DELETE FROM lexemes_morphemes WHERE lexemeId = ? AND id NOT IN (SELECT MIN(id) FROM lexemes_morphemes WHERE lexemeId = ? GROUP BY morphemeId)`).run(target.id, target.id)

            db.prepare(`UPDATE inflection_anomalies SET lexemeId = ? WHERE lexemeId = ?`).run(target.id, source.id)
            db.prepare(`DELETE FROM inflection_anomalies WHERE lexemeId = ? AND id NOT IN (SELECT MIN(id) FROM inflection_anomalies WHERE lexemeId = ? GROUP BY inflection, grammeme)`).run(target.id, target.id)

            // Уникальность (lexemeId, flavorId, type): конфликтующие строки остаются
            // на источнике и удаляются следом.
            db.prepare(`UPDATE OR IGNORE lexeme_allophones SET lexemeId = ? WHERE lexemeId = ?`).run(target.id, source.id)
            db.prepare(`DELETE FROM lexeme_allophones WHERE lexemeId = ?`).run(source.id)

            // Необязательные таблицы: proper_noun_signals создаёт отдельный
            // repeatable-скрипт (compute-proper-noun-signals.ts) и на проде её
            // может не быть вовсе, а valency_arguments появилась позже части
            // баз. Отсутствие таблицы не должно валить слияние — тогда просто
            // нет и ссылок, которые надо переносить.
            if (tables.has("proper_noun_signals")) {
                const targetHasSignal = db.prepare(`SELECT 1 FROM proper_noun_signals WHERE lexemeId = ? LIMIT 1`).get(target.id)
                if (targetHasSignal) db.prepare(`DELETE FROM proper_noun_signals WHERE lexemeId = ?`).run(source.id)
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
        }
        console.log(`  ${source.slug} -> ${target.slug}: meanings ${moved.length} moved`)
    }

    if (APPLY) {
        for (const [id, f] of freq) {
            db.prepare(`UPDATE lexemes SET corpusFrequency = ?, corpusFrequencyPerMln = ?, updatedAt = ? WHERE id = ?`)
                .run(f.abs, f.mln, now, id)
            audit(id, "corpusFrequencyPerMln", f.was.toFixed(1), f.mln.toFixed(1))
            const t = plans.find((p) => p.target.id === id)?.target
            console.log(`  freq ${t?.slug}: ${f.was.toFixed(1)} -> ${f.mln.toFixed(1)}/млн`)
        }
    }
})

if (APPLY) {
    const backup = `${DB_PATH}.backup-before-safe-duplicates`
    if (!fs.existsSync(backup)) { fs.copyFileSync(DB_PATH, backup); console.log(`backup: ${backup}\n`) }
}

run()
if (absentTables.size > 0) {
    console.log(`\nПропущены отсутствующие в этой базе таблицы (ссылок в них и нет): ${[...absentTables].join(", ")}`)
}
db.close()

if (!APPLY) {
    console.log("\nDry run only — re-run with --apply.")
    process.exit(0)
}

// corpus.db: ссылки на удалённые слаги + устаревшие ключи групп омонимов.
//
// Идемпотентно и без цикла по парам: в CorpusTokenCandidate НЕТ индекса по
// wordSlug, поэтому «по одному скану на пару» — это 7 полных проходов по 12,9
// млн строк (первый прогон на этом и повис). Здесь два прохода: один строит
// список затронутых токенов, второй переносит слаг одним CASE.
const corpus = new Database(CORPUS_PATH)
corpus.pragma("foreign_keys = ON")

const froms = PAIRS.map(([f]) => f)
const marks = froms.map(() => "?").join(",")

const repoint = corpus.transaction(() => {
    corpus.prepare(`CREATE TEMP TABLE affected_tokens AS
        SELECT DISTINCT tokenId FROM CorpusTokenCandidate WHERE wordSlug IN (${marks})`).run(...froms)

    // Ключ группы зависит от набора лексем-кандидатов: у токенов, где источник
    // был кандидатом, он стал неверным — снимаем. Вернутся в очередь после
    // ближайшей переразметки.
    const keysCleared = corpus.prepare(`UPDATE CorpusToken SET homonymGroupKey = NULL
        WHERE homonymGroupKey IS NOT NULL AND id IN (SELECT tokenId FROM affected_tokens)`).run().changes

    const caseExpr = froms.map(() => "WHEN ? THEN ?").join(" ")
    const caseParams = PAIRS.flatMap(([f, t]) => [f, t])
    const candidates = corpus.prepare(`UPDATE CorpusTokenCandidate
        SET wordSlug = CASE wordSlug ${caseExpr} ELSE wordSlug END
        WHERE wordSlug IN (${marks})`).run(...caseParams, ...froms).changes

    // Токены: идут по индексу CorpusToken_wordSlug_idx, поэтому дёшево.
    let tokens = 0
    for (const [from, to] of PAIRS) {
        tokens += corpus.prepare(`UPDATE CorpusToken SET wordSlug = ?, lemma = CASE WHEN lemma = ? THEN ? ELSE lemma END WHERE wordSlug = ?`).run(to, from, to, from).changes
        corpus.prepare(`UPDATE CorpusCandidateProposal SET siblingWordSlug = ? WHERE siblingWordSlug = ?`).run(to, from)
    }

    corpus.exec(`DROP TABLE affected_tokens`)
    console.log(`corpus: ${tokens} токенов перенаправлено, ${candidates} кандидатов, ${keysCleared} ключей групп снято`)
})
repoint()
corpus.close()
