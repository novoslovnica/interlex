// "Проход C" плана разрешения омонимии (см. lib/corpus/resolveHomonymsViaSyntax.ts)
// по всем документам корпуса — доразрешает омонимы через уже построенный
// dependency-граф (CorpusDependency) и управление глагола (VerbGovernment).
// Пока VerbGovernment пуст (см. lib/corpus/syntax/government.ts) — ожидаемо
// no-op на реальных данных, тот же случай, что и с флавор-приоритетом в
// Фазе 3; скрипт существует, чтобы это было воспроизводимо и годилось для
// прогона после того, как VerbGovernment начнёт заполняться.
//
// Usage:
//   npx tsx scripts/db/2026-07-28-resolve-homonyms-syntax-all-documents.ts [limit]

import { prismaCorpus } from "@/lib/prisma"
import { resolveHomonymsViaSyntax } from "@/lib/corpus/resolveHomonymsViaSyntax"

async function main() {
  const limitArg = process.argv[2] ? parseInt(process.argv[2], 10) : undefined

  const docs = await prismaCorpus.corpusDocument.findMany({
    select: { slug: true },
    orderBy: { slug: "asc" },
    ...(limitArg ? { take: limitArg } : {}),
  })

  console.log(`Resolving homonyms via syntax for ${docs.length} documents...`)

  let totalAmbiguous = 0
  let totalEdges = 0
  let totalChanged = 0
  let errors = 0
  const start = Date.now()

  for (let i = 0; i < docs.length; i++) {
    const slug = docs[i].slug
    try {
      const result = await resolveHomonymsViaSyntax(slug)
      if (result) {
        totalAmbiguous += result.ambiguousTotal
        totalEdges += result.dependencyEdgesConsidered
        totalChanged += result.winnersChanged
      }
    } catch (e) {
      errors++
      console.error(`  [${i + 1}/${docs.length}] FAILED slug=${slug}:`, e instanceof Error ? e.message : e)
    }

    if ((i + 1) % 200 === 0 || i === docs.length - 1) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`[${i + 1}/${docs.length}] elapsed=${elapsed}s ambiguous=${totalAmbiguous} edges=${totalEdges} changed=${totalChanged} errors=${errors}`)
    }
  }

  console.log("\n=== Done ===")
  console.log(`documents: ${docs.length}, errors: ${errors}`)
  console.log(`ambiguous tokens seen: ${totalAmbiguous}, governed dependency edges: ${totalEdges}, winners changed: ${totalChanged}`)

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
