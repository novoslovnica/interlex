import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`
process.env.CORPUS_DATABASE_URL = `file:${path.resolve(process.cwd(), "corpus.db")}`

async function main() {
  const { computeLexiconFrequencies } = await import(
    "@/lib/corpus/frequencies/compute-frequencies"
  )

  console.log("Computing lexicon frequencies from corpus data...")
  const result = await computeLexiconFrequencies()

  console.log("Done!")
  console.log(`  Updated lexemes:   ${result.updated}`)
  console.log(`  Total tokens:      ${result.totalTokens}`)
  console.log(`  Zipf alpha:        ${result.zipfAlpha ?? "N/A"}`)

  process.exit(0)
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})