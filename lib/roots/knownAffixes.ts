import type { prismaData } from "@/lib/prisma"

// Curated, hand-picked from standard Interslavic/Common-Slavic word formation
// (verbal aspect prefixes + common noun/adjective/verb-derivation suffixes).
// Necessary because the DB itself only has 9 PREFIX + 3 SUFFIX Morpheme rows
// (morphemes.type=1/2) — nowhere near enough to decompose the ~20,000
// lexemes with no root link. Merged with the DB rows at runtime by
// loadKnownAffixes() so any prefix/suffix a moderator adds later via
// /admin/roots (CreateRootModal with type=PREFIX/SUFFIX) automatically
// improves future discovery runs without a code change.
export const CURATED_PREFIXES: readonly string[] = [
  "obez", "protiv", "meju", "meždu", "sovmestno",
  "roz", "raz", "pere", "pred", "prěd", "vyz", "vzo",
  "bez", "vys", "vy", "vz", "do", "za", "iz", "is",
  "na", "nad", "ob", "od", "ot", "po", "pod", "pre", "pri",
  "pro", "su", "s", "u", "v", "vъz",
  "ne", "nai", "naj",
]

export const CURATED_SUFFIXES: readonly string[] = [
  "ost", "stvo", "stvie", "telj", "tel", "nik", "nica", "ica",
  "ina", "izm", "ist", "sk", "ov", "ev", "in", "ic", "ok", "ek",
  "ak", "ec", "ka", "je", "ie", "j", "b",
]

export interface KnownAffixes {
  prefixes: string[] // sorted longest-first
  suffixes: string[] // sorted longest-first
}

function byLengthDesc(a: string, b: string): number {
  return b.length - a.length
}

export async function loadKnownAffixes(db: typeof prismaData): Promise<KnownAffixes> {
  const rows = await db.morpheme.findMany({
    where: { type: { in: [1, 2] }, value: { not: null } },
    select: { value: true, type: true },
  })
  const dbPrefixes = rows.filter((r) => r.type === 1).map((r) => r.value!.toLowerCase())
  const dbSuffixes = rows.filter((r) => r.type === 2).map((r) => r.value!.toLowerCase())

  const prefixes = [...new Set([...CURATED_PREFIXES, ...dbPrefixes])].filter(Boolean)
  const suffixes = [...new Set([...CURATED_SUFFIXES, ...dbSuffixes])].filter(Boolean)
  prefixes.sort(byLengthDesc)
  suffixes.sort(byLengthDesc)

  return { prefixes, suffixes }
}
