import path from "path"
import Database from "better-sqlite3"

// Возвращает корпусную частотность всех лексем к значениям из резервной копии,
// снятой перед слиянием служебных дублей (2026-09-15).
//
// Зачем: частотность считается по леммам корпуса, то есть по победителям
// разбора. Пока разбор ошибался (см. 2026-09-16-carry-frequency-to-merge-targets.ts),
// пересчёт закреплял ошибку: "imeti, imati-AUX" набрал 10 622/млн на токенах
// imaje/imajut, а одноимённая VERB осталась с 12.7; voj-n ("воин") набрал 1297
// на токенах предлога "vo". С такими априорными значениями следующий разбор
// снова выберет ту же лексему — частотность важнее всего, когда обе лексемы
// дают форму буквально.
//
// Частотность — производная величина: её пересчитывает каждый полный прогон
// (scripts/compute-lexicon-frequency.ts), поэтому откат безопасен. Запускать
// ПЕРЕД реанализом, а сразу после — carry-frequency-to-merge-targets.ts,
// иначе цели слияния останутся с нулями, какие были до слияния.
//
// Usage:
//   npx tsx scripts/db/2026-09-16-restore-frequencies-from-backup.ts
//   npx tsx scripts/db/2026-09-16-restore-frequencies-from-backup.ts --apply

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
const BACKUP_PATH = process.env.BACKUP_DB || `${DB_PATH}.backup-before-service-duplicates`
const APPLY = process.argv.includes("--apply")

const FIELDS = ["corpusFrequency", "corpusFrequencyPerMln", "corpusRank", "corpusHapax", "distributionD"] as const

interface Row {
  slug: string
  corpusFrequency: number | null
  corpusFrequencyPerMln: number | null
  corpusRank: number | null
  corpusHapax: number | null
  distributionD: number | null
}

const db = new Database(DB_PATH)
const backup = new Database(BACKUP_PATH, { readonly: true })

console.log(`interlex: ${DB_PATH}\nbackup:   ${BACKUP_PATH}\nMode: ${APPLY ? "APPLY" : "DRY RUN"}\n`)

const select = `SELECT slug, ${FIELDS.join(", ")} FROM lexemes`
const before = new Map((db.prepare(select).all() as Row[]).map((r) => [r.slug, r]))
const restored = backup.prepare(select).all() as Row[]

const update = db.prepare(`UPDATE lexemes SET ${FIELDS.map((f) => `"${f}" = ?`).join(", ")} WHERE slug = ?`)

let changed = 0
let missing = 0
const samples: string[] = []

const run = db.transaction(() => {
  for (const row of restored) {
    const now = before.get(row.slug)
    if (!now) {
      // Лексема слита или удалена после снятия копии — восстанавливать нечего.
      missing++
      continue
    }
    if (FIELDS.every((f) => now[f] === row[f])) continue
    changed++
    if (samples.length < 12) {
      samples.push(`  ${row.slug}: ${(now.corpusFrequencyPerMln ?? 0).toFixed(1)} → ${(row.corpusFrequencyPerMln ?? 0).toFixed(1)} per mln`)
    }
    if (APPLY) update.run(...FIELDS.map((f) => row[f]), row.slug)
  }
})

run()

console.log(samples.join("\n"))
console.log(`\nLexemes in the backup: ${restored.length}, restored: ${changed}, gone since the backup: ${missing}`)
if (!APPLY) console.log("Dry run only — re-run with --apply.")

backup.close()
db.close()
