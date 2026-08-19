import { prismaData as db } from "@/lib/prisma"

/**
 * Next.js dynamic route params for non-ASCII segments (Latin diacritics,
 * Cyrillic - both occur in real slugs here, see AGENTS.md library/lexicon
 * notes) arrive still percent-encoded instead of auto-decoded in this
 * project's setup, so a raw `params.slug` never matches the plain-text
 * value stored in the DB and every such lookup 404s. Decode explicitly at
 * every call site instead of relying on Next.js to do it. Safe no-op on an
 * already-decoded value (no '%' to unescape) and on malformed sequences
 * (falls back to the original string rather than throwing).
 */
export function decodeSlugParam(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export async function generateUniqueSlug(
  value: string,
  pos: string,
  excludeId?: number,
): Promise<string> {
  const base = `${value.toLowerCase()}-${pos.trim() || "unknown"}`

  const existing = await db.lexeme.findUnique({ where: { slug: base } })
  if (!existing || existing.id === excludeId) return base

  let suffix = 2
  while (true) {
    const candidate = `${base}-${suffix}`
    const taken = await db.lexeme.findUnique({ where: { slug: candidate } })
    if (!taken || taken.id === excludeId) return candidate
    suffix++
  }
}