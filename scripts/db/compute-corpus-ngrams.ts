// Пересчёт CorpusNgram (roadmap #44, "Браузер устойчивых
// словосочетаний/n-грамм") — полный перезалив: bigram..5-gram частоты и
// метрики ассоциации по всему корпусу за один линейный проход
// (lib/corpus/collocations/computeNgrams.ts). Безопасно перезапускать
// сколько угодно раз — таблица не хранит ручных модераторских правок.
//
// Usage:
//   npx tsx scripts/db/compute-corpus-ngrams.ts

import dotenv from "dotenv"
import path from "path"

// lib/prisma.ts читает CORPUS_DATABASE_URL из process.env в момент
// импорта — без явной загрузки .env здесь клиент откатится на дефолтный
// ./prisma/corpus.db (0-байтный артефакт, не реальная база). Динамический
// import() ниже обязателен, не косметика: esbuild (tsx) хостит статические
// import наверх файла, так что статический import lib/prisma-зависимого
// модуля выполнился бы раньше dotenv.config() несмотря на порядок строк в
// исходнике — см. тот же приём в generate-corpus-candidate-proposals.ts.
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

async function main() {
  const { computeNgrams, NGRAM_SIZES, MIN_NGRAM_FREQUENCY } = await import(
    "@/lib/corpus/collocations/computeNgrams"
  )

  console.log(`Computing corpus n-grams (sizes=${NGRAM_SIZES.join(",")}, minFrequency=${MIN_NGRAM_FREQUENCY})...`)
  const start = Date.now()
  const result = await computeNgrams()
  const seconds = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`\nDone in ${seconds}s`)
  console.log(`Total matched tokens: ${result.totalMatchedTokens}`)
  for (const [n, count] of Object.entries(result.written)) {
    console.log(`  n=${n}: ${count} rows`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
