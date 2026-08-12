// Пересчёт readabilityScore/readabilityLevel/readabilityCoverage (roadmap
// п.42, миграция scripts/db/2026-08-12-add-library-readability.ts) для всех
// текстов /library. Безопасно перезапускать сколько угодно раз — просто
// перезаписывает три колонки на актуальные значения, никакого статуса
// модератора здесь нет (в отличие от CorpusCandidateProposal), терять нечего.
//
// Usage:
//   npx tsx scripts/db/backfill-library-readability.ts

import dotenv from "dotenv"
import path from "path"

// См. generate-corpus-candidate-proposals.ts за подробным объяснением: tsx
// хостит статические import наверх файла, поэтому lib/prisma-зависимые
// модули должны импортироваться динамически, уже ПОСЛЕ dotenv.config().
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

async function main() {
    const { prismaLibrary } = await import("@/lib/prisma")
    const { decompressBody } = await import("@/lib/body")
    const { computeReadability } = await import("@/lib/library/computeReadability")

    const entries = await prismaLibrary.libraryEntry.findMany({
        where: { body: { not: null } },
        select: { id: true, slug: true, body: true },
    })

    console.log(`Найдено ${entries.length} текстов с непустым body.`)
    const start = Date.now()
    let updated = 0
    let skipped = 0

    for (const entry of entries) {
        if (!entry.body) continue
        const rawText = decompressBody(entry.body)
        const { score, level, coverage } = await computeReadability(rawText)

        if (level === null) {
            skipped++
        } else {
            updated++
        }

        await prismaLibrary.libraryEntry.update({
            where: { id: entry.id },
            data: { readabilityScore: score, readabilityLevel: level, readabilityCoverage: coverage },
        })

        console.log(`  ${entry.slug}: level=${level ?? "—"} score=${score?.toFixed(2) ?? "—"} coverage=${(coverage * 100).toFixed(0)}%`)
    }

    console.log(`\nГотово за ${((Date.now() - start) / 1000).toFixed(1)}с: ${updated} оценено, ${skipped} пропущено (недостаточно покрытия).`)
    await prismaLibrary.$disconnect()
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
