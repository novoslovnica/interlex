import { prismaData as db } from "@/lib/prisma"

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