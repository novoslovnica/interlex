// Repairs root_discovery_proposals rows written by the pre-fix version of
// scripts/roots-discovery/discover-new-roots.ts, which passed an
// already-JSON.stringify()'d string into memberLexemeIds/exampleLexemeIds
// (Prisma `Json` columns) — Prisma then serialized that string AGAIN,
// double-encoding it. A read back out returns a JS string instead of an
// array, which crashed /admin/root-discovery with
// "exampleLexemeIds.map is not a function".
//
// Idempotent: only touches rows where the field is currently a string
// (double-encoded); already-correct rows (real array/object) are left
// alone, so it's safe to re-run after the fixed discover-new-roots.ts has
// written new, correctly-encoded rows alongside old ones.
//
// Usage:
//   npx tsx scripts/db/2026-08-17-fix-double-encoded-root-discovery-json.ts [--apply]

import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`

const APPLY = process.argv.includes("--apply")

async function main() {
  const { prismaData: db } = await import("@/lib/prisma")

  const rows = await db.rootDiscoveryProposal.findMany({
    select: { id: true, clusterKey: true, memberLexemeIds: true, exampleLexemeIds: true },
  })

  let fixed = 0
  let alreadyOk = 0

  for (const row of rows) {
    const memberIsString = typeof row.memberLexemeIds === "string"
    const exampleIsString = typeof row.exampleLexemeIds === "string"

    if (!memberIsString && !exampleIsString) {
      alreadyOk++
      continue
    }

    const memberFixed = memberIsString ? JSON.parse(row.memberLexemeIds as unknown as string) : row.memberLexemeIds
    const exampleFixed = exampleIsString ? JSON.parse(row.exampleLexemeIds as unknown as string) : row.exampleLexemeIds

    console.log(`[fix] proposal ${row.id} "${row.clusterKey}" — memberLexemeIds string: ${memberIsString}, exampleLexemeIds string: ${exampleIsString}`)
    fixed++

    if (APPLY) {
      await db.rootDiscoveryProposal.update({
        where: { id: row.id },
        data: { memberLexemeIds: memberFixed, exampleLexemeIds: exampleFixed },
      })
    }
  }

  console.log(`\n--- ${APPLY ? "Applied" : "Dry run"} ---`)
  console.log(`Rows checked: ${rows.length}`)
  console.log(`Double-encoded, fixed: ${fixed}`)
  console.log(`Already correct: ${alreadyOk}`)
  if (!APPLY) console.log("\nRe-run with --apply to write.")

  await db.$disconnect()
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
