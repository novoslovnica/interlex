// Bulk-populates CorpusTokenCandidate (homonym disambiguation Phase 1)
// across every existing document. The table didn't exist when these
// documents were first tokenized, so it starts empty for all of them —
// this backfills it going forward. Reuses reanalyzeCorpusDocument(), the
// same function the per-document "Пересчитать POS-tagging" admin button
// calls; analyzer/collocationMatcher are built once up front instead of
// once per document (both do a full table scan over lexemes).
//
// Tokens already marked resolutionSource='manual' are left untouched by
// reanalyzeCorpusDocument() itself (see lib/corpus/reanalyzeDocument.ts) —
// safe to run against a corpus with existing manual edits.
//
// Usage:
//   npx tsx scripts/db/2026-07-28-reanalyze-all-documents.ts [limit]

import { prismaCorpus } from "@/lib/prisma"
import { CollocationMatcher } from "@/lib/corpus/tokenizer/collocationMatcher"
import { buildCollocationRecords, createDbAnalyzer } from "@/lib/corpus/tokenizer/analyzer-factory"
import { reanalyzeCorpusDocument } from "@/lib/corpus/reanalyzeDocument"

async function main() {
  const limitArg = process.argv[2] ? parseInt(process.argv[2], 10) : undefined

  console.log("Building analyzer (valid endings, known prepositions, collocations)...")
  const analyzer = await createDbAnalyzer()
  const collocationMatcher = new CollocationMatcher(await buildCollocationRecords())

  const docs = await prismaCorpus.corpusDocument.findMany({
    select: { slug: true },
    orderBy: { slug: "asc" },
    ...(limitArg ? { take: limitArg } : {}),
  })

  console.log(`Reanalyzing ${docs.length} documents...`)

  let totalAnalyzed = 0
  let totalFailed = 0
  let totalSkippedManual = 0
  let totalTokens = 0
  let errors = 0
  const start = Date.now()

  for (let i = 0; i < docs.length; i++) {
    const slug = docs[i].slug
    try {
      const result = await reanalyzeCorpusDocument(slug, analyzer, collocationMatcher)
      if (result) {
        totalAnalyzed += result.analyzed
        totalFailed += result.failed
        totalSkippedManual += result.skippedManual
        totalTokens += result.total
      }
    } catch (e) {
      errors++
      console.error(`  [${i + 1}/${docs.length}] FAILED slug=${slug}:`, e instanceof Error ? e.message : e)
    }

    if ((i + 1) % 25 === 0 || i === docs.length - 1) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      const rate = ((i + 1) / ((Date.now() - start) / 1000)).toFixed(2)
      console.log(`[${i + 1}/${docs.length}] elapsed=${elapsed}s rate=${rate}doc/s tokens=${totalTokens} analyzed=${totalAnalyzed} failed=${totalFailed} skippedManual=${totalSkippedManual} errors=${errors}`)
    }
  }

  const candidateCount = await prismaCorpus.corpusTokenCandidate.count()
  const ambiguousCount = await prismaCorpus.corpusToken.count({ where: { matchCount: { gt: 1 } } })

  console.log("\n=== Done ===")
  console.log(`documents: ${docs.length}, errors: ${errors}`)
  console.log(`tokens: ${totalTokens}, analyzed: ${totalAnalyzed}, failed(unrecognized): ${totalFailed}, skippedManual: ${totalSkippedManual}`)
  console.log(`CorpusTokenCandidate rows total in DB: ${candidateCount}`)
  console.log(`tokens with matchCount>1 (ambiguous) total in DB: ${ambiguousCount}`)

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
