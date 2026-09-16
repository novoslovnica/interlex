import fs from "fs"
import path from "path"
import Database from "better-sqlite3"
import { randomUUID } from "crypto"

// Вторая партия дублей: старые записи со строчным POS в слаге ("denj-n",
// "prvy-adj") и их двойники нового формата с тем же написанием. План решён
// с мейнтейнером 2026-09-16 по классам, а не построчно, поэтому пары
// вычисляются здесь же, а не перечисляются руками.
//
// Правило: цель — запись с бóльшим числом непустых переводов (у legacy это
// обычно 0–7 против 17–18 у новой; при равенстве — больше значений, затем
// меньший id). Частотность цели = сумма участников, и считается ДО удаления
// источника — иначе следующий пересчёт закрепит проигрыш цели (см.
// 2026-09-16-carry-frequency-to-merge-targets.ts). updatedAt проставляется
// явно: corpus-refresh отбирает работу по нему, а прямой SQL его не двигает.
//
// Сливаются только пары с ОДИНАКОВЫМ POS плюс явно разрешённые классы
// (CROSS_POS ниже). Пара пропускается, если русские переводы сторон не
// пересекаются ни одним словом: там настоящие омонимы (ves «счастье» и
// «деревня», zelo «капуста» и «жало», cestny «частный» и «честный»)
// — такие мейнтейнер разбирает отдельно.
//
// Usage:
//   npx tsx scripts/db/2026-09-16-merge-legacy-duplicate-lexemes.ts
//   npx tsx scripts/db/2026-09-16-merge-legacy-duplicate-lexemes.ts --apply

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
const CORPUS_PATH = process.env.CORPUS_DB || path.resolve(process.cwd(), "corpus.db")
const APPLY = process.argv.includes("--apply")
const AUTHOR = "script:merge-legacy-duplicate-lexemes"

// Разрешённые пары разных POS. ADV/ADP (kromě, okolo, poslě) сюда НЕ входят:
// подтверждено, что эти слова бывают и наречием, и предлогом — две лексемы.
const CROSS_POS: Array<[string, string]> = [
  ["ADJ", "NUM"], ["NOUN", "NUM"],   // порядковые и счётные: цель — NUM
  ["VERB", "AUX"],                    // hteti/stati/trebovati/morati — глаголы
]

// POS цели, переопределённый решением мейнтейнера: hteti/stati/trebovati —
// глаголы, а не вспомогательные (настоящие AUX — mogti, museti, umeti… —
// в парах не участвуют).
const FORCE_POS: Record<string, string> = {
  "hteti-AUX": "VERB", "stati-AUX": "VERB", "trebovati-AUX": "VERB",
}

// Правки полей, не связанные со слиянием.
const FIELD_FIXES: Array<{ slug: string; field: string; value: string }> = [
  // Стем хранил "už, už": второй вариант потерял окончание, форма "uže" не
  // порождалась вовсе, и все её вхождения забирал ųž-n (уж, змея).
  { slug: "uz, uze-ADV", field: "stem", value: "už, uže" },
]

const LEGACY = /-(adv|part|int|pron|n|v|adj|prep|conj|phr|num|undefined)$/

const db = new Database(DB_PATH)
db.pragma("foreign_keys = ON")

interface Lex {
  id: number; slug: string; value: string | null; stem: string | null; pos: string | null
  corpusFrequency: number | null; corpusFrequencyPerMln: number | null
}

const FOLD: Record<string, string> = {
  'ȯ':'o','ė':'e','ě':'e','ų':'u','ę':'e','ǫ':'u','đ':'d','ł':'l','ľ':'l','ť':'t','ď':'d','ň':'n',
  'ś':'s','ź':'z','ć':'c','č':'c','š':'s','ž':'z','ń':'n','å':'a','ŕ':'r','ĺ':'l','ȍ':'o','ъ':'','ь':'',
}
const fold = (s: string) => [...(s || "").toLowerCase().normalize("NFC")].map((c) => FOLD[c] ?? c).join("")
const firstForm = (value: string | null) => fold((value ?? "").split(",")[0].trim())

const all = db.prepare(`SELECT id, slug, value, stem, pos, corpusFrequency, corpusFrequencyPerMln FROM lexemes`).all() as Lex[]
const translationCount = db.prepare(`SELECT COUNT(*) c FROM translations t JOIN meanings m ON m.id = t.meaningId WHERE m.lexemeId = ? AND t.value != ''`)
const meaningCount = db.prepare(`SELECT COUNT(*) c FROM meanings WHERE lexemeId = ?`)
// lower() в SQLite приводит только ASCII, поэтому регистр снимаем в JS:
// иначе "Алфавит" и "алфавит" считались разными словами.
const russian = db.prepare(`SELECT group_concat(t.value, ' ') v FROM translations t JOIN meanings m ON m.id = t.meaningId WHERE m.lexemeId = ? AND t.language = 'ru' AND t.value != ''`)
const count = (stmt: typeof translationCount, id: number) => (stmt.get(id) as { c: number }).c
const ruWords = (id: number) => new Set(((russian.get(id) as { v: string | null }).v ?? "").toLowerCase().match(/[а-яёa-z]{3,}/g) ?? [])

const byForm = new Map<string, Lex[]>()
for (const l of all) for (const v of (l.value ?? "").split(",")) {
  const k = fold(v.trim()); if (!k) continue
  byForm.set(k, [...(byForm.get(k) ?? []), l])
}

// Разные слова — это когда ОБА стема несут диакритику, но разную:
// čęstn (частный) и čestn (честный), cěl (целое) и čel (лоб), brež и brěz.
// Если же диакритика есть только у одной стороны, а вторая — голый ASCII
// ("bodec" против "bodėc", "breg" против "brěg", "car" против "caŕ"), то это
// одно слово, просто старая запись без знаков. Слова, которые при этом всё же
// различаются (sev «сев» и šev «шов»), отсекает следующая проверка — по
// непересекающимся переводам.
const hasDiacritics = (s: string) => [...s].some((ch) => ch.charCodeAt(0) > 127)
function spellingDiffers(a: string | null, b: string | null): boolean {
  const x = (a ?? "").toLowerCase().normalize("NFC")
  const y = (b ?? "").toLowerCase().normalize("NFC")
  if (!x || !y || x === y) return false
  if (!hasDiacritics(x) || !hasDiacritics(y)) return false
  const xs = [...x], ys = [...y]
  return xs.length === ys.length && xs.some((ch, i) => ch !== ys[i])
}

interface Plan { target: Lex; source: Lex }
const plans: Plan[] = []
const skippedSense: string[] = []
const skippedSpelling: string[] = []
const skippedEmpty: string[] = []

for (const source of all) {
  if (!LEGACY.test(source.slug)) continue
  const twins = (byForm.get(firstForm(source.value)) ?? []).filter((o) => o.id !== source.id && !LEGACY.test(o.slug))
  const allowed = twins.filter((t) => t.pos === source.pos
    || CROSS_POS.some(([a, b]) => (source.pos === a && t.pos === b) || (source.pos === b && t.pos === a)))
  if (allowed.length === 0) continue

  const rank = (l: Lex) => [count(translationCount, l.id), count(meaningCount, l.id), -l.id]
  const members = [source, ...allowed].sort((x, y) => {
    const a = rank(x), b = rank(y)
    return b[0] - a[0] || b[1] - a[1] || b[2] - a[2]
  })
  const target = members[0]
  if (target.id === source.id && allowed.every((t) => count(translationCount, t.id) === 0)) {
    skippedEmpty.push(`${source.slug} vs ${allowed.map((t) => t.slug).join(", ")}`)
    continue
  }
  for (const other of members.slice(1)) {
    // Переводы решают первыми: они точнее правописания. Пересеклись хоть
    // одним словом — одно слово, как бы ни расходилась запись (desět/desęť,
    // cěsarstv/cěsaŕstv). Не пересеклись — разные слова (čęstny «частный» и
    // čestny «честный», sev «сев» и šev «шов»).
    const a = ruWords(target.id), b = ruWords(other.id)
    if (a.size > 0 && b.size > 0) {
      if ([...a].some((w) => b.has(w))) { plans.push({ target, source: other }); continue }
      skippedSense.push(`${other.slug} (${[...b].slice(0, 3).join(" ")}) vs ${target.slug} (${[...a].slice(0, 3).join(" ")})`)
      continue
    }
    // Сравнить нечего — тогда судим по написанию.
    if (spellingDiffers(target.stem, other.stem)) {
      skippedSpelling.push(`${other.slug} (${other.stem}) vs ${target.slug} (${target.stem})`)
      continue
    }
    plans.push({ target, source: other })
  }
}

console.log(`interlex: ${DB_PATH}\nMode: ${APPLY ? "APPLY" : "DRY RUN"}\n`)
console.log(`Слияний: ${plans.length}`)
if (!APPLY) for (const pl of plans) {
  console.log(`  СЛИТЬ ${pl.source.slug} [${pl.source.pos}, ${(pl.source.corpusFrequencyPerMln ?? 0).toFixed(1)}/млн] -> ${pl.target.slug} [${pl.target.pos}, ${(pl.target.corpusFrequencyPerMln ?? 0).toFixed(1)}/млн]`)
}
console.log(`Пропущено как разные написания (čęstny/čestny, sev/šev): ${skippedSpelling.length}`)
console.log(`Пропущено как разные слова (переводы не пересекаются): ${skippedSense.length}`)
console.log(`Пропущено как пустые с обеих сторон: ${skippedEmpty.length}`)

const norm = (s: string | null) => (s ?? "").trim().toLowerCase()
const meaningIds = (id: number) => (db.prepare(`SELECT id FROM meanings WHERE lexemeId = ? ORDER BY id`).all(id) as { id: number }[]).map((r) => r.id)
const keysOf = (meaningId: number) => (db.prepare(`SELECT language, value FROM translations WHERE meaningId = ?`).all(meaningId) as { language: string; value: string | null }[])
  .filter((t) => norm(t.value) !== "").map((t) => `${t.language}::${norm(t.value)}`)

function audit(entityId: number, field: string, oldValue: unknown, newValue: unknown) {
  db.prepare(`INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail, createdAt)
    VALUES (?, 'Lexeme', ?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)`)
    .run(randomUUID(), entityId, field, oldValue === null || oldValue === undefined ? null : String(oldValue), newValue === null || newValue === undefined ? null : String(newValue), AUTHOR)
}

type Entry = number | { id: number; flavor?: string }
function moveBaseHomonyms(sourceId: number, targetId: number) {
  for (const h of db.prepare(`SELECT id, wordIds FROM base_homonyms`).all() as { id: number; wordIds: string }[]) {
    const entries = JSON.parse(h.wordIds) as Entry[]
    const idOf = (e: Entry) => (typeof e === "number" ? e : e.id)
    if (!entries.some((e) => idOf(e) === sourceId)) continue
    const hasTarget = entries.some((e) => idOf(e) === targetId)
    const next = entries.flatMap((e): Entry[] => idOf(e) !== sourceId ? [e] : hasTarget ? [] : [typeof e === "number" ? targetId : { ...e, id: targetId }])
    if (next.length === 0) db.prepare(`DELETE FROM base_homonyms WHERE id = ?`).run(h.id)
    else db.prepare(`UPDATE base_homonyms SET wordIds = ? WHERE id = ?`).run(JSON.stringify(next), h.id)
  }
}

const slugMap = new Map<string, string>()
const now = new Date().toISOString().replace("Z", "+00:00")

const run = db.transaction(() => {
  const freq = new Map<number, { abs: number; mln: number; was: number }>()
  for (const { target, source } of plans) {
    const acc = freq.get(target.id) ?? { abs: target.corpusFrequency ?? 0, mln: target.corpusFrequencyPerMln ?? 0, was: target.corpusFrequencyPerMln ?? 0 }
    acc.abs += source.corpusFrequency ?? 0
    acc.mln += source.corpusFrequencyPerMln ?? 0
    freq.set(target.id, acc)
  }

  for (const { target, source } of plans) {
    const targetKeys = new Set(meaningIds(target.id).flatMap(keysOf))
    let moved = 0, dropped = 0
    for (const m of meaningIds(source.id)) {
      const keys = keysOf(m)
      if (keys.length > 0 && keys.every((k) => targetKeys.has(k))) {
        dropped++
        if (APPLY) db.prepare(`DELETE FROM meanings WHERE id = ?`).run(m)
      } else {
        moved++
        if (APPLY) db.prepare(`UPDATE meanings SET lexemeId = ? WHERE id = ?`).run(target.id, m)
      }
    }
    slugMap.set(source.slug, target.slug)
    if (!APPLY) continue
    db.prepare(`UPDATE lexemes_morphemes SET lexemeId = ? WHERE lexemeId = ?`).run(target.id, source.id)
    db.prepare(`DELETE FROM lexemes_morphemes WHERE lexemeId = ? AND id NOT IN (SELECT MIN(id) FROM lexemes_morphemes WHERE lexemeId = ? GROUP BY morphemeId)`).run(target.id, target.id)
    db.prepare(`UPDATE inflection_anomalies SET lexemeId = ? WHERE lexemeId = ?`).run(target.id, source.id)
    db.prepare(`DELETE FROM inflection_anomalies WHERE lexemeId = ? AND id NOT IN (SELECT MIN(id) FROM inflection_anomalies WHERE lexemeId = ? GROUP BY inflection, grammeme)`).run(target.id, target.id)
    db.prepare(`UPDATE OR IGNORE lexeme_allophones SET lexemeId = ? WHERE lexemeId = ?`).run(target.id, source.id)
    db.prepare(`UPDATE content_reports SET lexemeId = ? WHERE lexemeId = ?`).run(target.id, source.id)
    db.prepare(`UPDATE content_reports SET entityId = ? WHERE entityType = 'Lexeme' AND entityId = ?`).run(target.id, source.id)
    moveBaseHomonyms(source.id, target.id)
    audit(target.id, "mergedFrom", null, `${source.id} ${source.slug}`)
    db.prepare(`DELETE FROM lexemes WHERE id = ?`).run(source.id)
    console.log(`  ${source.slug} (${(source.corpusFrequencyPerMln ?? 0).toFixed(1)}/mln) -> ${target.slug}: meanings ${moved} moved, ${dropped} dropped`)
  }

  if (APPLY) {
    for (const [id, f] of freq) {
      db.prepare(`UPDATE lexemes SET corpusFrequency = ?, corpusFrequencyPerMln = ?, updatedAt = ? WHERE id = ?`).run(f.abs, f.mln, now, id)
      audit(id, "corpusFrequencyPerMln", f.was.toFixed(1), f.mln.toFixed(1))
    }
    for (const [slug, pos] of Object.entries(FORCE_POS)) {
      const row = db.prepare(`SELECT id, pos FROM lexemes WHERE slug = ?`).get(slug) as { id: number; pos: string | null } | undefined
      if (!row || row.pos === pos) continue
      db.prepare(`UPDATE lexemes SET pos = ?, updatedAt = ? WHERE id = ?`).run(pos, now, row.id)
      audit(row.id, "pos", row.pos, pos)
      console.log(`  ${slug}: pos ${row.pos} -> ${pos}`)
    }
    for (const fix of FIELD_FIXES) {
      const row = db.prepare(`SELECT id, "${fix.field}" v FROM lexemes WHERE slug = ?`).get(fix.slug) as { id: number; v: string | null } | undefined
      if (!row || row.v === fix.value) continue
      db.prepare(`UPDATE lexemes SET "${fix.field}" = ?, updatedAt = ? WHERE id = ?`).run(fix.value, now, row.id)
      audit(row.id, fix.field, row.v, fix.value)
      console.log(`  ${fix.slug}: ${fix.field} "${row.v}" -> "${fix.value}"`)
    }
  }
})

if (APPLY) {
  const backup = `${DB_PATH}.backup-before-legacy-duplicates`
  if (!fs.existsSync(backup)) { fs.copyFileSync(DB_PATH, backup); console.log(`backup: ${backup}\n`) }
}
run()
db.close()

if (!APPLY) {
  console.log("\nПропущенные как разные написания:")
  for (const s of skippedSpelling.slice(0, 999)) console.log(`  ${s}`)
  console.log("\nПропущенные как разные слова:")
  for (const s of skippedSense.slice(0, 999)) console.log(`  ${s}`)
  console.log("\nПропущенные как пустые:")
  for (const s of skippedEmpty.slice(0, 999)) console.log(`  ${s}`)
  console.log("\nDry run only — re-run with --apply.")
} else {
  const corpus = new Database(CORPUS_PATH)
  const repoint = corpus.transaction(() => {
    let n = 0
    for (const [from, to] of slugMap) {
      n += corpus.prepare(`UPDATE CorpusToken SET wordSlug = ?, lemma = CASE WHEN lemma = ? THEN ? ELSE lemma END WHERE wordSlug = ?`).run(to, from, to, from).changes
      corpus.prepare(`UPDATE CorpusCandidateProposal SET siblingWordSlug = ? WHERE siblingWordSlug = ?`).run(to, from)
    }
    console.log(`\ncorpus: ${n} tokens re-pointed`)
  })
  repoint()
  corpus.close()
}
