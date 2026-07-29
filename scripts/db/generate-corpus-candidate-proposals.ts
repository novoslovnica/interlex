// Батч-генерация CorpusCandidateProposal по всем красным (matchCount=0) и
// жёлтым (matchCount=1 && isPartialMatch) токенам корпуса — план
// "автогенерация кандидатов из красных/жёлтых токенов" (2026-07-29,
// см. lib/corpus/candidates/).
//
// Безопасно перезапускать сколько угодно раз: upsert по (clusterKey,
// ruleSource, guessedStemType, guessedGrammeme) обновляет только
// occurrenceCount/exampleTokenIds/lastSeenAt/rank/possibleEndingGap —
// status (и решение модератора) никогда не перезаписывается повторным
// прогоном. См. generateCorpusCandidateProposals() за деталями.
//
// "Жёлтая" ветка требует актуального CorpusToken.isPartialMatch — колонка
// добавлена в той же миграции (scripts/db/2026-07-29-add-corpus-candidate-proposals.ts),
// но НЕ бэкфиллится автоматически для уже проанализированных документов.
// Если жёлтых кандидатов оказывается 0 на давно не пересчитывавшемся
// корпусе — сначала прогоните:
//   npx tsx scripts/db/2026-07-28-reanalyze-all-documents.ts
//
// На реальном корпусе (73 793 различных красных словоформы на момент
// написания) полный прогон в один процесс упирается в утечку памяти где-то
// в движке Prisma 7 / driver-adapter (не в коде этого скрипта — буфер
// upsert'ов уже коммитится пачками и не растёт неограниченно, но резидентная
// память процесса всё равно растёт по ходу тысяч последовательных
// $transaction; воспроизведено и с 4, и с 8 ГБ хипа). Практический обход —
// прогонять по частям через необязательный [limit] (ограничивает число
// обрабатываемых КЛАСТЕРОВ/словоформ, не токенов) и перезапускать процесс
// между частями — каждый повторный прогон идемпотентен (см. upsert-ключ
// выше), поэтому безопасно звать скрипт несколько раз подряд, увеличивая
// нижеидущий предел, вплоть до покрытия всего корпуса.
//
// Usage:
//   npx tsx scripts/db/generate-corpus-candidate-proposals.ts [limit] [offset]

import dotenv from "dotenv"
import path from "path"

// lib/prisma.ts читает DATA_DATABASE_URL/CORPUS_DATABASE_URL из process.env
// в момент импорта — без явной загрузки .env здесь оба клиента откатятся на
// дефолтный ./prisma/*.db (которого не существует, есть только 0-байтные
// артефакты, см. историю). Динамический import() ниже — не косметика: esbuild
// (tsx) хостит статические import наверх файла, поэтому статический import
// lib/prisma-зависимого модуля выполнился бы РАНЬШЕ dotenv.config() ниже,
// несмотря на порядок строк в исходнике — проверено эмпирически на этом
// самом скрипте.
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

async function main() {
  const { generateCorpusCandidateProposals } = await import("@/lib/corpus/candidates/generateProposals")

  const clusterLimit = process.argv[2] ? parseInt(process.argv[2], 10) : undefined
  const clusterOffset = process.argv[3] ? parseInt(process.argv[3], 10) : undefined

  console.log(`Generating corpus candidate proposals... (limit=${clusterLimit ?? "∞"}, offset=${clusterOffset ?? 0})`)
  const start = Date.now()
  const result = await generateCorpusCandidateProposals({ clusterLimit, clusterOffset })
  const seconds = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`\nDone in ${seconds}s`)
  console.log(`Red tokens (matchCount=0):                    ${result.redTokens}`)
  console.log(`Yellow tokens (matchCount=1 && isPartialMatch): ${result.yellowTokens}`)
  console.log(`Distinct clusters (unique surface forms):      ${result.clustersProcessed}`)
  console.log(`Hypothesis rows upserted:                      ${result.hypothesesUpserted}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
