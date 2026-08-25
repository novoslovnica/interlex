// Загружает кандидатов из JSON, выгруженного export-candidates.ts.
//
// Идемпотентен: запись с такой же парой (value, pos) среди
// непромотированных пропускается — повторный запуск не плодит дубликаты
// (ровно та проблема, из-за которой "medžuslovjansky" оказался в базе
// трижды, см. 2026-08-25-dedupe-corpus-candidates.ts).
//
// Usage:
//   npx tsx scripts/db/import-candidates.ts candidates-export.json [--apply]

import * as path from "path"
import * as fs from "fs"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`

async function main() {
    const { prismaData } = await import("@/lib/prisma")
    const { logAudit } = await import("@/lib/audit-log")

    const inPath = process.argv[2]
    if (!inPath) {
        console.error("Укажите файл: npx tsx scripts/db/import-candidates.ts candidates-export.json [--apply]")
        process.exit(1)
    }
    const apply = process.argv.includes("--apply")

    const payload = JSON.parse(fs.readFileSync(inPath, "utf8")) as Record<string, unknown>[]
    console.log(`В файле кандидатов: ${payload.length}`)

    let created = 0
    let skipped = 0
    for (const row of payload) {
        const value = row.value as string | null
        const pos = row.pos as string | null
        const existing = await prismaData.candidate.findFirst({
            where: { value, pos, promotedAt: null },
            select: { id: true },
        })
        if (existing) {
            console.log(`  пропуск (уже есть, id=${existing.id}): ${value} / ${pos}`)
            skipped++
            continue
        }
        console.log(`  ${apply ? "добавляю" : "добавил бы"}: ${value} / ${pos}`)
        created++
        if (!apply) continue

        const candidate = await prismaData.candidate.create({ data: row })
        await logAudit(undefined, "Candidate", candidate.id, [
            { field: "importedFrom", oldValue: null, newValue: path.basename(inPath) },
            { field: "value", oldValue: null, newValue: candidate.value },
            { field: "pos", oldValue: null, newValue: candidate.pos },
        ])
    }

    console.log(`\nДобавлено: ${created}, пропущено: ${skipped}`)
    if (!apply && created > 0) console.log("Это прогон вхолостую. Повторите с --apply.")
    process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
