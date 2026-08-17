// Phase C of the root-morpheme cleanup pipeline. Rerunnable / safe to
// schedule: only ever writes qualityFlag* fields, and ONLY for rows where
// qualityFlagStatus IS NULL — a moderator's prior decision ('pending' left
// as-is by them, or 'dismissed'/'resolved') is never touched again, the
// same reimport-safety idiom as CorpusCandidateProposal.status /
// CorpusToken.resolutionSource / semantic_relations.source elsewhere in
// this project. No --apply flag needed: there is nothing destructive here,
// value/type/protoSlavicWordId are never modified.
//
// Checks, beyond the two exact patterns scripts/roots-discovery/
// fix-known-root-bugs.ts already handles once (numeric value, known-affix
// collision above a large-nest threshold):
//   - Any root that newly appears with a numeric value (in case future data
//     entry reintroduces the bug) is flagged the same way.
//   - Any root whose value collides with a known affix, regardless of nest
//     size (Phase A only auto-flagged the >20-lexeme "pri" case; smaller
//     collisions like a 2-4-lexeme "nad"/"pod" nest are ambiguous — could
//     be genuine short roots that happen to equal a prefix string, or could
//     be smaller-scale versions of the same contamination pattern — so
//     they're surfaced here for a human glance, not auto-fixed).
//   - "implausible_nest_size": any short root (value.length <= 3) linked to
//     an unusually large number of lexemes (> 20) — a generic proxy for
//     "possibly another undiscovered contamination case," independent of
//     whether it happens to collide with a specific known affix string.
//
// Usage:
//   npx tsx scripts/roots-discovery/audit-root-quality.ts

import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`

const IMPLAUSIBLE_NEST_LINKED_COUNT = 20
const IMPLAUSIBLE_NEST_MAX_VALUE_LEN = 3

async function main() {
  const { prismaData: db } = await import("@/lib/prisma")
  const { loadKnownAffixes } = await import("@/lib/roots/knownAffixes")

  const roots = await db.morpheme.findMany({
    where: { type: 0, qualityFlagStatus: null },
    select: {
      id: true,
      value: true,
      lexemes_morphemes: { select: { lexemeId: true } },
    },
  })

  const dbAffixes = await db.morpheme.findMany({
    where: { type: { in: [1, 2] }, value: { not: null } },
    select: { id: true, value: true, type: true },
  })
  const dbAffixByValue = new Map(dbAffixes.map((a) => [a.value!.toLowerCase(), a]))
  const known = await loadKnownAffixes(db)

  let flaggedNumeric = 0
  let flaggedCollision = 0
  let flaggedImplausibleNest = 0

  for (const root of roots) {
    const value = root.value ?? ""
    const linkedCount = root.lexemes_morphemes.length
    const lower = value.toLowerCase()

    let flag: string | null = null
    let details: Record<string, unknown> = { linkedLexemeCount: linkedCount }

    if (/^\d+$/.test(value)) {
      flag = "corrupted_numeric_value"
    } else {
      const dbCollision = dbAffixByValue.get(lower)
      const isPrefix = dbCollision ? dbCollision.type === 1 : known.prefixes.includes(lower)
      const isSuffix = dbCollision ? dbCollision.type === 2 : known.suffixes.includes(lower)
      if (dbCollision || isPrefix || isSuffix) {
        flag = isPrefix ? "affix_collision_prefix" : "affix_collision_suffix"
        details = { ...details, collidesWithMorphemeId: dbCollision?.id ?? null, source: dbCollision ? "db" : "curated" }
      } else if (linkedCount > IMPLAUSIBLE_NEST_LINKED_COUNT && value.length <= IMPLAUSIBLE_NEST_MAX_VALUE_LEN) {
        flag = "implausible_nest_size"
      }
    }

    if (!flag) continue

    console.log(`[${flag}] root ${root.id} "${value}" (${linkedCount} linked lexemes)`)
    if (flag === "corrupted_numeric_value") flaggedNumeric++
    else if (flag.startsWith("affix_collision")) flaggedCollision++
    else flaggedImplausibleNest++

    await db.morpheme.update({
      where: { id: root.id },
      data: {
        qualityFlag: flag,
        qualityFlagDetails: JSON.stringify(details),
        qualityFlagStatus: "pending",
        qualityFlaggedAt: new Date(),
      },
    })
  }

  console.log(`\n--- Done ---`)
  console.log(`Checked ${roots.length} unflagged roots.`)
  console.log(`Newly flagged: numeric=${flaggedNumeric}, affix_collision=${flaggedCollision}, implausible_nest_size=${flaggedImplausibleNest}`)

  await db.$disconnect()
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
