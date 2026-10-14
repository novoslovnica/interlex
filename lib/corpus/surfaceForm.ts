import { etymCyrToEtymLat, isCyrillic } from "@/lib/transliteration"

/**
 * Канонический ключ словоформы: нижний регистр + перевод этимологической
 * кириллицы в латиницу. Одна и та же функция группирует токены в очереди
 * кандидатов (`CorpusCandidateProposal.clusterKey`) и в очереди массовой
 * разметки омонимов (roadmap п.111, `lib/corpus/homonymGroup.ts`).
 *
 * Вынесена из `lib/corpus/candidates/reconstruct.ts` в отдельный модуль без
 * единого импорта `@/lib/prisma`, потому что ею пользуется и скрипт бэкфилла
 * `scripts/db/2026-10-14-backfill-homonym-group-keys.ts` — а тот ходит в
 * corpus.db напрямую через better-sqlite3 и не должен тянуть за собой ни один
 * Prisma-клиент (см. docs/history/2026-07-29-corpus-candidate-proposals.md,
 * п.2 про hoisting импортов у tsx). `reconstruct.ts` реэкспортирует её, чтобы
 * все существующие импорты продолжали работать.
 */
export function normalizeSurfaceForm(rawSurfaceForm: string): string {
  let clean = rawSurfaceForm.toLowerCase().trim()
  if (isCyrillic(clean)) {
    clean = etymCyrToEtymLat(clean)
  }
  return clean
}
