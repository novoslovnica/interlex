import path from "path"
import Database from "better-sqlite3"
import { randomUUID } from "crypto"

// Переносит корпусную частотность слитых лексем на цель слияния
// (2026-09-15-merge-service-duplicate-lexemes.ts). Само слияние этого не
// сделало: у целей нового формата ("tak, tako-ADV", "dobro-ADV") частотность
// была нулевой, вся она лежала на старых записях ("tako-adv" 3544/млн), и после
// слияния "tako" стал выигрывать прилагательным taky (5120/млн), а "dobro" —
// dobry. Пересчёт частотности этого не чинит, а закрепляет: он считает её по
// леммам корпуса, то есть по тем самым неверным победителям.
//
// Значения берутся из резервной копии, снятой перед слиянием, и суммируются
// по цели и всем её источникам. После этого нужен полный прогон реанализа —
// ранжирование кандидатов читает именно corpusFrequencyPerMln.
//
// Usage:
//   npx tsx scripts/db/2026-09-16-carry-frequency-to-merge-targets.ts
//   npx tsx scripts/db/2026-09-16-carry-frequency-to-merge-targets.ts --apply

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
const BACKUP_PATH = process.env.BACKUP_DB || `${DB_PATH}.backup-before-service-duplicates`
const APPLY = process.argv.includes("--apply")
const AUTHOR = "script:carry-frequency-to-merge-targets"

// target → все участники слияния (цель и её источники), id из merge-скрипта.
const GROUPS: Record<number, number[]> = {
  12478: [12478, 1940, 1941, 1942],
  4483: [4483, 8],
  6278: [6278, 399],
  13000: [13000, 2051],
  13081: [13081, 2076],
  9499: [9499, 1148, 1149, 9500],
  9520: [9520, 1150],
  19653: [19653, 3417],
  6679: [6679, 496],
  20147: [20147, 3560],
  4640: [4640, 24, 4641],
  9874: [9874, 1228],
  19876: [19876, 3461],
  20905: [20905, 3983, 3760, 3761, 21500, 21472],
  5890: [5890, 9268, 19319],
  18048: [18048, 3263],
  10481: [10481, 1359],
  10955: [10955, 1546],
  8489: [8489, 967],
  19974: [19974, 3482],
  20673: [20673, 3855],
  11362: [11362, 1656],
  9199: [9199, 11363],
  10832: [10832, 1493],
  22332: [22332, 4238],
  22310: [22310, 4237],
  10811: [10811, 1484, 1485],
}

const db = new Database(DB_PATH)
const backup = new Database(BACKUP_PATH, { readonly: true })

interface FreqRow { slug: string; corpusFrequency: number | null; corpusFrequencyPerMln: number | null }

const fromBackup = backup.prepare(`SELECT slug, corpusFrequency, corpusFrequencyPerMln FROM lexemes WHERE id = ?`)
const current = db.prepare(`SELECT slug, corpusFrequency, corpusFrequencyPerMln FROM lexemes WHERE id = ?`)

console.log(`interlex: ${DB_PATH}\nbackup:   ${BACKUP_PATH}\nMode: ${APPLY ? "APPLY" : "DRY RUN"}\n`)

const run = db.transaction(() => {
  for (const [targetIdRaw, members] of Object.entries(GROUPS)) {
    const targetId = Number(targetIdRaw)
    const target = current.get(targetId) as FreqRow | undefined
    if (!target) throw new Error(`target ${targetId} not found`)

    let absolute = 0
    let perMln = 0
    for (const member of members) {
      const row = fromBackup.get(member) as FreqRow | undefined
      if (!row) throw new Error(`member ${member} not found in the backup`)
      absolute += row.corpusFrequency ?? 0
      perMln += row.corpusFrequencyPerMln ?? 0
    }

    console.log(`${target.slug} (${targetId}): ${(target.corpusFrequencyPerMln ?? 0).toFixed(1)} → ${perMln.toFixed(1)} per mln`)
    if (!APPLY) continue

    db.prepare(`UPDATE lexemes SET corpusFrequency = ?, corpusFrequencyPerMln = ? WHERE id = ?`).run(absolute, perMln, targetId)
    db.prepare(`
      INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail, createdAt)
      VALUES (?, 'Lexeme', ?, 'corpusFrequencyPerMln', ?, ?, NULL, ?, CURRENT_TIMESTAMP)
    `).run(randomUUID(), targetId, String(target.corpusFrequencyPerMln ?? 0), String(perMln), AUTHOR)
  }
})

run()
backup.close()
db.close()
if (!APPLY) console.log("\nDry run only — re-run with --apply.")
