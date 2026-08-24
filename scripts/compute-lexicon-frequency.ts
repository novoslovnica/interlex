import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`
process.env.CORPUS_DATABASE_URL = `file:${path.resolve(process.cwd(), "corpus.db")}`

async function main() {
  const { computeLexiconFrequencies } = await import(
    "@/lib/corpus/frequencies/compute-frequencies"
  )
  const { computeCefrLevels } = await import(
    "@/lib/corpus/frequencies/compute-cefr-levels"
  )

  console.log("Computing lexicon frequencies from corpus data...")
  const result = await computeLexiconFrequencies()

  console.log(`  Updated lexemes:   ${result.updated}`)
  console.log(`  Total tokens:      ${result.totalTokens}`)
  console.log(`  Zipf alpha:        ${result.zipfAlpha ?? "N/A"}`)

  // CEFR выводится из только что пересчитанных частотностей, поэтому обязан
  // идти следом. Раньше этот скрипт считал только частотность, а
  // POST /api/admin/recompute-frequencies — и то и другое: после прогона
  // через CLI уровни CEFR молча оставались от предыдущего состояния корпуса.
  // Два пути к одной операции, у одного не хватало шага — тот же класс
  // расхождения, что уже разбирался в этом проекте (см. AGENTS.md про
  // engine.ts и declineNoun.ts).
  console.log("Computing CEFR levels from the fresh frequencies...")
  const cefr = await computeCefrLevels()
  console.log(`  Updated lexemes:   ${cefr.updated}`)

  console.log("Done!")
  process.exit(0)
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})