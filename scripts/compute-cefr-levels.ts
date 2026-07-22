import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`
process.env.CORPUS_DATABASE_URL = `file:${path.resolve(process.cwd(), "corpus.db")}`

async function main() {
  const { computeCefrLevels } = await import(
    "@/lib/corpus/frequencies/compute-cefr-levels"
  )

  console.log("Computing CEFR levels from corpus data...")
  const result = await computeCefrLevels()

  console.log("Done!")
  console.log(`  Updated lexemes:   ${result.updated}`)
  console.log(`  Total tokens:       ${result.totalTokens}`)
  console.log(`  Total lexemes:      ${result.totalLexemes}`)

  process.exit(0)
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})