import { normalizeSurfaceForm } from "@/lib/corpus/surfaceForm"

/**
 * Массовая разметка омонимов (roadmap п.111).
 *
 * На живом корпусе 1,09 млн токенов имеют не менее двух РАЗНЫХ лексем среди
 * кандидатов (`scripts/db/measure-corpus-ambiguity.ts`), но эти токены
 * схлопываются в считанные тысячи групп вида «одна словоформа + один и тот же
 * набор конкурирующих лексем»: форма `ne` — 79,8 тыс. токенов, `na` — 52 тыс.,
 * `se` — 41,9 тыс. Одно решение модератора по такой группе закрывает сразу все
 * её токены, что и делает очередь конечной (TokenSidebar решает по одному).
 *
 * Группа — это именно конкуренция РАЗНЫХ лексем. Когда спорят только граммемы
 * одной и той же лексемы (лексема и часть речи уже верны), размечать нечего:
 * это работа синтаксического разбора/ранжирования, а не модератора, поэтому
 * `homonymGroupKey` для таких токенов возвращает null.
 *
 * Разделитель — символ ␟ (U+241F), как и в `CorpusNgram.ngramKey`: в обычном
 * тексте он не встречается и не может дать ложное совпадение с частью формы.
 */
export const HOMONYM_GROUP_SEPARATOR = "\u241F"

// Слаги лексем разделяются "|": слаг — это `value-pos` (напр. "ne-PART",
// "na-ADP"), ни `value`, ни `pos` не содержат "|", в отличие от "," и "-",
// которые в слагах реально встречаются ("imeti, imati-VERB").
const SLUG_SEPARATOR = "|"

/**
 * Ключ группы омонимов для токена — либо null, если конкурирующей лексемы
 * всего одна (или ни одной).
 *
 * Чистая функция: её вызывает и рантайм-путь записи токенов, и скрипт
 * бэкфилла на существующем корпусе, поэтому она обязана быть без единого
 * обращения к БД — иначе два пути рано или поздно разъедутся.
 */
export function homonymGroupKey(
  surfaceForm: string,
  candidateWordSlugs: readonly string[],
): string | null {
  const slugs = [...new Set(candidateWordSlugs.filter((s) => s.length > 0))]
  if (slugs.length < 2) return null
  slugs.sort()
  return `${normalizeSurfaceForm(surfaceForm)}${HOMONYM_GROUP_SEPARATOR}${slugs.join(SLUG_SEPARATOR)}`
}

/** Разбор ключа обратно — для отображения конкурирующих лексем в очереди. */
export function parseHomonymGroupKey(groupKey: string): { form: string; wordSlugs: string[] } | null {
  const at = groupKey.indexOf(HOMONYM_GROUP_SEPARATOR)
  if (at < 0) return null
  const slugPart = groupKey.slice(at + HOMONYM_GROUP_SEPARATOR.length)
  const wordSlugs = slugPart.split(SLUG_SEPARATOR).filter((s) => s.length > 0)
  if (wordSlugs.length < 2) return null
  return { form: groupKey.slice(0, at), wordSlugs }
}

/**
 * Ключ группы по списку кандидатов (форма + слаги) — общая точка для всех
 * путей записи токенов, чтобы никто не собирал ключ вручную.
 */
export function homonymGroupKeyForCandidates(
  surfaceForm: string,
  candidates: readonly { wordSlug: string }[],
): string | null {
  return homonymGroupKey(surfaceForm, candidates.map((c) => c.wordSlug))
}
