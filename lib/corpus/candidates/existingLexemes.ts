import { prismaData } from "@/lib/prisma"
import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"
import { expandVariants } from "@/lib/corpus/tokenizer/lexemeVariants"

export interface ExistingLexeme {
  id: number
  slug: string
  value: string | null
  pos: string | null
}

// Свёрнутое словарное написание -> лексемы. Сравнение идёт с точностью до
// диакритики: реконструкция из корпуса почти всегда упрощённая ("jezyk"), а в
// словаре может стоять каноническое "język" — и это то же самое слово.
//
// Индекс строится по всему словарю (~25 тыс. строк) и живёт в памяти процесса
// несколько минут: очередь кандидатов открывают постоянно, а словарь между
// открытиями почти не меняется. Промоут кандидата сбрасывает кэш сам.
const TTL_MS = 5 * 60_000
let cache: { builtAt: number; index: Map<string, ExistingLexeme[]> } | null = null

function keyOf(form: string): string {
  return foldDiacritics(form.toLowerCase().trim())
}

async function getIndex(): Promise<Map<string, ExistingLexeme[]>> {
  if (cache && Date.now() - cache.builtAt < TTL_MS) return cache.index

  const rows = await prismaData.lexeme.findMany({ select: { id: true, slug: true, value: true, pos: true } })
  const index = new Map<string, ExistingLexeme[]>()
  for (const row of rows) {
    // Статья может держать несколько написаний через запятую ("altana, altanka").
    for (const variant of expandVariants(row.value)) {
      const key = keyOf(variant)
      const list = index.get(key)
      if (list) list.push(row)
      else index.set(key, [row])
    }
  }
  cache = { builtAt: Date.now(), index }
  return index
}

export function resetExistingLexemeIndex(): void {
  cache = null
}

/** Лексемы, чья словарная форма совпадает с form с точностью до диакритики. */
export async function findExistingLexemes(form: string): Promise<ExistingLexeme[]> {
  return (await getIndex()).get(keyOf(form)) ?? []
}

export async function findExistingLexemesMany(forms: string[]): Promise<Map<string, ExistingLexeme[]>> {
  const index = await getIndex()
  const result = new Map<string, ExistingLexeme[]>()
  for (const form of forms) {
    const found = index.get(keyOf(form))
    if (found) result.set(form, found)
  }
  return result
}
