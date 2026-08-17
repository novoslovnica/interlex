// Phase A of the root-morpheme cleanup pipeline (see the approved plan at
// /Users/georgecarpow/.claude/plans/crystalline-strolling-bengio.md).
//
// Fixes exactly the two confirmed, deterministic data-corruption patterns in
// root (type=0) Morpheme rows, scoped narrowly rather than as a general
// heuristic sweep:
//
//   (a) "corrupted_numeric_value": value is a bare integer string (e.g. "1",
//       "1640") instead of real text. Confirmed on 36 rows, each with
//       exactly one linked lexeme — the fix is to set value = that lexeme's
//       own value. Any numeric-value root with a DIFFERENT linked-lexeme
//       count (0 or >1) is a different, riskier situation and is only
//       flagged (qualityFlag), never auto-fixed.
//
//   (b) "affix_collision": a root's value collides case-insensitively with
//       an existing PREFIX/SUFFIX (type=1/2) Morpheme's value AND has an
//       implausibly large linked-lexeme count — the "pri" bug (181 lexemes
//       wrongly clustered under a fake root because they merely start with
//       the prefix "pri-"). Never auto-deleted/retyped — that's a
//       linguistic judgment a human must make via /admin/roots?flagged=true
//       (see app/api/roots/[id]/route.ts DELETE, already gated
//       Feature.RootsDelete). Only flagged here.
//
// Dry-run by default; pass --apply to write. Idempotent: re-running after
// --apply finds nothing left to fix (values are no longer numeric) and
// skips rows whose qualityFlagStatus is already set (a prior run already
// flagged them).
//
// Usage:
//   npx tsx scripts/roots-discovery/fix-known-root-bugs.ts [--apply]

import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`

const APPLY = process.argv.includes("--apply")

// Above this linked-lexeme count, a root value colliding with a known
// affix is treated as likely contamination worth flagging for review
// rather than a coincidental short root (e.g. a genuine 3-letter root that
// happens to also be a prefix string, which can legitimately exist).
const COLLISION_LINKED_COUNT_THRESHOLD = 20

async function main() {
  const { prismaData: db } = await import("@/lib/prisma")
  const { logAudit } = await import("@/lib/audit-log")
  const { loadKnownAffixes } = await import("@/lib/roots/knownAffixes")

  const scriptUser = { email: "script:fix-known-root-bugs" }

  const roots = await db.morpheme.findMany({
    where: { type: 0 },
    select: {
      id: true,
      value: true,
      qualityFlagStatus: true,
      lexemes_morphemes: { select: { lexeme: { select: { id: true, value: true } } } },
    },
  })

  // Real DB-registered affixes (for pointing at a concrete colliding Morpheme
  // id in the flag details) plus the curated list from lib/roots/knownAffixes
  // (for catching real Slavic affixes like "pri" that this project hasn't
  // registered as a Morpheme row yet but that are still definitely not
  // roots — see AGENTS.md's "pri" contamination writeup).
  const dbAffixes = await db.morpheme.findMany({
    where: { type: { in: [1, 2] }, value: { not: null } },
    select: { id: true, value: true, type: true },
  })
  const dbAffixByValue = new Map(dbAffixes.map((a) => [a.value!.toLowerCase(), a]))
  const known = await loadKnownAffixes(db)
  const curatedAffixSet = new Set([...known.prefixes, ...known.suffixes])

  let numericFixed = 0
  let numericFlaggedOther = 0
  let collisionFlagged = 0
  let alreadyFlaggedSkipped = 0

  for (const root of roots) {
    const value = root.value ?? ""
    const isNumeric = /^\d+$/.test(value)
    const linkedLexemes = root.lexemes_morphemes.map((lm) => lm.lexeme).filter((l): l is { id: number; value: string | null } => !!l)

    if (isNumeric) {
      if (linkedLexemes.length === 1 && linkedLexemes[0].value) {
        const correctValue = linkedLexemes[0].value
        console.log(`[numeric_fix] root ${root.id}: "${value}" -> "${correctValue}" (lexeme ${linkedLexemes[0].id})`)
        numericFixed++
        if (APPLY) {
          await db.morpheme.update({ where: { id: root.id }, data: { value: correctValue } })
          await logAudit(scriptUser, "Morpheme", root.id, [{ field: "value", oldValue: value, newValue: correctValue }])
        }
        continue
      }

      if (root.qualityFlagStatus) {
        alreadyFlaggedSkipped++
        continue
      }
      console.log(
        `[numeric_flag] root ${root.id}: "${value}" has ${linkedLexemes.length} linked lexemes (expected exactly 1) — flagging for review, not auto-fixing`
      )
      numericFlaggedOther++
      if (APPLY) {
        await db.morpheme.update({
          where: { id: root.id },
          data: {
            qualityFlag: "corrupted_numeric_value",
            qualityFlagDetails: JSON.stringify({ linkedLexemeCount: linkedLexemes.length, linkedLexemeIds: linkedLexemes.map((l) => l.id) }),
            qualityFlagStatus: "pending",
            qualityFlaggedAt: new Date(),
          },
        })
      }
      continue
    }

    // Affix-collision check: flag roots whose value IS a known affix (either
    // a real DB-registered PREFIX/SUFFIX Morpheme, or a curated Slavic
    // affix this project hasn't registered as a Morpheme row yet — "pri" is
    // exactly this case, it has no colliding DB row but is unambiguously
    // the prefix "при-", not a root) with an implausibly large nest.
    if (root.qualityFlagStatus) {
      alreadyFlaggedSkipped++
      continue
    }
    const lower = value.toLowerCase()
    const dbCollision = dbAffixByValue.get(lower)
    const isCuratedAffix = curatedAffixSet.has(lower)
    if ((dbCollision || isCuratedAffix) && linkedLexemes.length > COLLISION_LINKED_COUNT_THRESHOLD) {
      const isPrefix = dbCollision ? dbCollision.type === 1 : known.prefixes.includes(lower)
      const flagType = isPrefix ? "affix_collision_prefix" : "affix_collision_suffix"
      console.log(
        `[collision_flag] root ${root.id} "${value}" is a known ${isPrefix ? "prefix" : "suffix"}${dbCollision ? ` (collides with morpheme ${dbCollision.id})` : " (curated list, no DB row yet)"}, linked to ${linkedLexemes.length} lexemes`
      )
      collisionFlagged++
      if (APPLY) {
        await db.morpheme.update({
          where: { id: root.id },
          data: {
            qualityFlag: flagType,
            qualityFlagDetails: JSON.stringify({
              collidesWithMorphemeId: dbCollision?.id ?? null,
              collidesWithValue: value,
              source: dbCollision ? "db" : "curated",
              linkedLexemeCount: linkedLexemes.length,
            }),
            qualityFlagStatus: "pending",
            qualityFlaggedAt: new Date(),
          },
        })
      }
    }
  }

  console.log(`\n--- ${APPLY ? "Applied" : "Dry run"} ---`)
  console.log(`Numeric-value roots fixed (single linked lexeme): ${numericFixed}`)
  console.log(`Numeric-value roots flagged (unexpected lexeme count, not auto-fixed): ${numericFlaggedOther}`)
  console.log(`Affix-collision roots flagged: ${collisionFlagged}`)
  console.log(`Skipped (already had a qualityFlagStatus from a prior run): ${alreadyFlaggedSkipped}`)
  if (!APPLY) console.log("\nDry run only — re-run with --apply to write.")

  await db.$disconnect()
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
