// Замкнутый цикл обновления корпуса после правок словаря.
//
// Что делает по шагам (порядок важен, см. refreshCorpusForChangedLexemes):
//   1. находит лексемы, изменившиеся с прошлого запуска (Lexeme.updatedAt);
//   2. переразмечает только те предложения, где встречаются их словоформы;
//   3. закрывает предложения по словам, переставшим быть красными/жёлтыми;
//   4. пересобирает предложения по затронутым словам;
//   5. пересчитывает частотность и уровни CEFR;
//   6. двигает отметку времени в corpus_config.
//
// Рассчитан на регулярный запуск на том же сервере, где ведётся словарь —
// после партии промоушенов в /admin/candidates. Полный прогон
// (2026-07-28-reanalyze-all-documents.ts) остаётся для правок самого
// грамматического движка, когда меняется разбор всех слов сразу.
//
// Пути к БД проставляются здесь же, до динамического импорта — как в
// scripts/compute-lexicon-frequency.ts (статический import lib/prisma
// выполнился бы раньше любого dotenv.config, см. AGENTS.md про tsx).
//
// Usage:
//   npm run corpus:refresh
//   npm run corpus:refresh -- --since=2026-08-01   # пересчитать шире
//   npm run corpus:refresh -- --dry-watermark      # не двигать отметку

import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`
process.env.CORPUS_DATABASE_URL = `file:${path.resolve(process.cwd(), "corpus.db")}`

function parseSince(): Date | undefined {
  const arg = process.argv.find((a) => a.startsWith("--since="))
  if (!arg) return undefined
  const value = new Date(arg.slice("--since=".length))
  if (Number.isNaN(value.getTime())) {
    console.error(`Не разобрал дату в ${arg}`)
    process.exit(1)
  }
  return value
}

async function main() {
  const { refreshCorpusForChangedLexemes } = await import("@/lib/corpus/refresh")
  const { computeLexiconFrequencies } = await import("@/lib/corpus/frequencies/compute-frequencies")
  const { computeCefrLevels } = await import("@/lib/corpus/frequencies/compute-cefr-levels")

  const started = Date.now()
  const result = await refreshCorpusForChangedLexemes({
    since: parseSince(),
    dryWatermark: process.argv.includes("--dry-watermark"),
    log: (m) => console.log(`  ${m}`),
  })

  if (result.affectedTokens > 0) {
    // Частотность считается по корпусным леммам, а они только что менялись.
    console.log("  Пересчёт частотности и CEFR...")
    const freq = await computeLexiconFrequencies()
    const cefr = await computeCefrLevels()
    console.log(`  Частотность: ${freq.updated} лексем, CEFR: ${cefr.updated}`)
  } else {
    console.log("  Затронутых токенов нет — частотность не трогаем")
  }

  console.log(`\n=== Готово за ${((Date.now() - started) / 1000).toFixed(1)}с ===`)
  console.log(`Изменившихся лексем:        ${result.changedLexemes}`)
  console.log(`Затронуто токенов:          ${result.affectedTokens}`)
  console.log(`Затронуто предложений:      ${result.affectedSentences}`)
  console.log(`Переразмечено токенов:      ${result.reanalyzed}`)
  console.log(`Осталось нераспознанными:   ${result.stillUnrecognized}`)
  console.log(`Закрыто кластеров:          ${result.closedClusters}`)
  console.log(`Пересобрано кластеров:      ${result.newClusters}`)
  console.log(`Отметка времени:            ${result.watermark.toISOString()}`)

  process.exit(0)
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
