import { prismaData } from "@/lib/prisma"

export interface LexemeDisplayInfo {
  id: number
  value: string
}

// Lexeme.value is a search/matching-normalization field, not the real
// orthographic form of the word — the actual written form lives in the
// CORE flavor's "standard" allophone (lexeme_allophones). Same source of
// truth app/api/lexicon/services.ts's enrichLexemeRows already uses
// (item.word = la_core "standard" allophone) and that Home.tsx's WordCard
// renders (`item.word?.value || item.value`, CORE first, Lexeme.value only
// as a fallback when no CORE allophone row exists at all).
// SQLite caps bound parameters (~999 by default) — an `in: [...]` with
// thousands of slugs (routine for the n-gram browser's vocabulary) throws
// P2029 "query parameter limit exceeded" otherwise.
const CHUNK = 300

export async function resolveLexemeDisplayValues(slugs: string[]): Promise<Map<string, LexemeDisplayInfo>> {
  const result = new Map<string, LexemeDisplayInfo>()
  const distinctSlugs = [...new Set(slugs)]
  if (distinctSlugs.length === 0) return result

  for (let i = 0; i < distinctSlugs.length; i += CHUNK) {
    const chunk = distinctSlugs.slice(i, i + CHUNK)
    const lexemes = await prismaData.lexeme.findMany({
      where: { slug: { in: chunk } },
      select: {
        id: true,
        slug: true,
        value: true,
        lexemeAllophones: {
          where: { type: "standard", flavor: { code: "CORE" } },
          select: { value: true },
          take: 1,
        },
      },
    })
    for (const l of lexemes) {
      const coreValue = l.lexemeAllophones[0]?.value
      result.set(l.slug, { id: l.id, value: coreValue || l.value || l.slug })
    }
  }
  return result
}
