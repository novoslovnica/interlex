// Приводит очередь кандидатов в соответствие с текущим состоянием корпуса:
// закрывает кластеры, чьи токены перестали быть красными/жёлтыми, и отсеивает
// не-слова — см. reconcileProposals() в lib/corpus/candidates/generateProposals.ts.
//
// corpus:refresh вызывает то же самое внутри инкрементального цикла; этот
// скрипт нужен после полного прогона реанализа и генерации предложений
// (2026-07-28-reanalyze-all-documents.ts + generate-corpus-candidate-proposals.ts),
// когда цикл refresh не запускался.
//
// Usage: npx tsx scripts/db/reconcile-corpus-proposals.ts

import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true })

async function main() {
  const { reconcileProposals } = await import("@/lib/corpus/candidates/generateProposals")
  const started = Date.now()
  const result = await reconcileProposals()
  console.log(`Готово за ${((Date.now() - started) / 1000).toFixed(1)}s`)
  console.log(result)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
