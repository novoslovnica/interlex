// Phase B of the root-morpheme cleanup pipeline. For every root (type=0)
// Morpheme with no CONFIRMED protoSlavicWordId yet, computes a match
// against proto_slavic_words (see lib/roots/protoMatch.ts) via
// lib/proto.ts's normalizeProtoLemma/normalizeRootValueForMatching.
//
//   - Exact + unique normalized match -> auto-apply eligible: with --apply,
//     sets protoSlavicWordId directly and logs the change via logAudit
//     (the user-confirmed threshold: "when the match is unambiguous and
//     exact, apply automatically").
//   - Everything else (fuzzy match, or an exact match tied between 2+
//     ESSJa entries) -> cached as protoSuggestionId/protoSuggestionScore,
//     protoSuggestionStatus='pending', for review in /admin/roots. Never
//     auto-applied, dry-run or not.
//
// Idempotent on rerun: skips any root whose protoSuggestionStatus is
// already 'dismissed'/'applied'/'auto_applied' (a moderator or a prior
// --apply run already decided it) — only rows with protoSuggestionStatus
// null/'pending' and protoSlavicWordId null are reconsidered.
//
// Dry-run by default; pass --apply to write the auto-apply-eligible cases.
// The suggestion cache is written on every run regardless of --apply (it's
// non-destructive draft data, not a confirmed fact).
//
// Usage:
//   npx tsx scripts/roots-discovery/match-roots-to-proto.ts [--apply]

import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`

const APPLY = process.argv.includes("--apply")

async function main() {
  const { prismaData: db } = await import("@/lib/prisma")
  const { logAudit } = await import("@/lib/audit-log")
  const { buildProtoIndex, matchRootToProto } = await import("@/lib/roots/protoMatch")

  const scriptUser = { email: "script:match-roots-to-proto" }

  console.log("Building Proto-Slavic index...")
  const index = await buildProtoIndex(db)
  console.log(`Indexed ${index.exactMap.size} distinct normalized lemmas.\n`)

  const roots = await db.morpheme.findMany({
    where: {
      type: 0,
      protoSlavicWordId: null,
      // Prisma's `notIn` excludes NULL rows under SQL semantics (NULL NOT IN
      // (...) is unknown, not true) — the OR makes "never suggested yet"
      // (status IS NULL) explicit rather than silently skipped.
      OR: [{ protoSuggestionStatus: null }, { protoSuggestionStatus: { notIn: ["dismissed", "applied", "auto_applied"] } }],
    },
    select: { id: true, value: true },
  })

  let autoApplied = 0
  let exactTie = 0
  let fuzzySuggested = 0
  let noMatch = 0

  for (const root of roots) {
    if (!root.value) continue
    const match = matchRootToProto(root.value, index)
    if (!match) {
      noMatch++
      continue
    }

    if (match.exactUnique) {
      autoApplied++
      console.log(`[auto_apply] root ${root.id} "${root.value}" -> proto ${match.protoSlavicWordId} (exact, unique)`)
      if (APPLY) {
        await db.morpheme.update({
          where: { id: root.id },
          data: {
            protoSlavicWordId: match.protoSlavicWordId,
            protoSuggestionId: match.protoSlavicWordId,
            protoSuggestionScore: 1,
            protoSuggestionStatus: "auto_applied",
            protoSuggestionReviewedAt: new Date(),
          },
        })
        await logAudit(scriptUser, "Morpheme", root.id, [
          { field: "protoSlavicWordId", oldValue: null, newValue: match.protoSlavicWordId },
        ])
      }
      continue
    }

    if (match.tieCount > 0) exactTie++
    else fuzzySuggested++
    console.log(
      `[suggest] root ${root.id} "${root.value}" -> proto ${match.protoSlavicWordId} (score ${match.score.toFixed(2)}${match.tieCount > 0 ? `, ${match.tieCount} ties` : ""})`
    )
    // Suggestions are written every run regardless of --apply: they're a
    // non-destructive cache, not a confirmed fact.
    await db.morpheme.update({
      where: { id: root.id },
      data: {
        protoSuggestionId: match.protoSlavicWordId,
        protoSuggestionScore: match.score,
        protoSuggestionStatus: "pending",
      },
    })
  }

  console.log(`\n--- ${APPLY ? "Applied" : "Dry run (suggestions still cached)"} ---`)
  console.log(`Roots considered: ${roots.length}`)
  console.log(`Auto-applied (exact + unique): ${autoApplied}`)
  console.log(`Suggested, exact but tied between multiple proto entries: ${exactTie}`)
  console.log(`Suggested, fuzzy match: ${fuzzySuggested}`)
  console.log(`No match found (below fuzzy threshold): ${noMatch}`)
  if (!APPLY) console.log("\nRe-run with --apply to write the auto-apply-eligible exact matches.")

  await db.$disconnect()
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
