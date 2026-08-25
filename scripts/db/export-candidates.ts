// Выгружает нерассмотренные записи `candidates` в переносимый JSON.
//
// Нужно потому, что кандидаты живут в interlex.db, а он на прод не
// переносится — там свой словарь, который обрастает переводами
// (см. docs/deploy-2026-08-25-recognition.md). Одобрения, сделанные локально
// в /admin/corpus-candidates, иначе просто потерялись бы.
//
// id и promotedAt не выгружаются: на проде своя последовательность
// автоинкремента, а промоушен — отдельное решение, которое там и принимается.
//
// Usage: npx tsx scripts/db/export-candidates.ts [файл.json]

import * as path from "path"
import * as fs from "fs"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`

async function main() {
    const { prismaData } = await import("@/lib/prisma")
    const outPath = process.argv[2] ?? "candidates-export.json"

    const rows = await prismaData.candidate.findMany({
        where: { promotedAt: null },
        orderBy: { id: "asc" },
    })

    const payload = rows.map(({ id, createdAt, updatedAt, promotedAt, promotedToLexemeId, ...rest }) => {
        void id; void createdAt; void updatedAt; void promotedAt; void promotedToLexemeId
        return rest
    })

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n")
    console.log(`Выгружено кандидатов: ${payload.length} -> ${outPath}`)
    for (const c of payload) console.log(`  ${c.value} / ${c.pos} / стем ${c.stem}`)
    process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
