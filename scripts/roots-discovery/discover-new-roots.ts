// Phase D of the root-morpheme cleanup pipeline. Proposes brand-new root
// nests for lexemes that currently have no type=0 (ROOT) Morpheme link at
// all (~82% of the lexicon). Writes ONLY to the root_discovery_proposals
// staging table — never touches Morpheme/LexemeMorpheme directly. Actual
// root creation happens exclusively via a moderator approving a proposal
// in /admin/root-discovery (app/admin/root-discovery/actions.ts).
//
// Two clustering methods, in order of confidence:
//
//   1. 'affix_strip' (primary): strip a known prefix/suffix from each
//      unlinked lexeme's value (lib/roots/stripAffixes.ts) and group by
//      EXACT match on the remaining stem. Deliberately not fuzzy — this is
//      a direct response to the "pri" contamination bug (see
//      fix-known-root-bugs.ts's header), where raw substring-frequency
//      scoring let a shared prefix outscore the real, rarer root. Grouping
//      on the full remainder after stripping a *specific* known affix can't
//      reproduce that failure mode. Minimum 2 members to propose a root —
//      singleton residuals are recorded in the report but never proposed
//      (a root nest of one word, discovered from nothing but that one word,
//      would be fabricating structure rather than finding it).
//
//   2. 'raw_substring_fallback' (secondary, lower confidence): for lexemes
//      whose value doesn't decompose via any known affix, bucket by the
//      first 3 characters (plausible-cognate heuristic: an underived root
//      is word-initial, so real cognates should share their start) and,
//      within each bucket, reuse the project's existing longest-common-
//      substring miner (lib/roots/substringMiner.ts, extracted from
//      scripts/extract-root-candidates.ts) — only proposed when the
//      winning substring's match ratio exceeds 0.7 (the same threshold
//      that script already used to trust a "primary" candidate). Tagged
//      distinctly so the review UI can visually de-emphasize it.
//
// Every proposal gets a cached Proto-Slavic suggestion (never applied,
// staging only) via the same lib/roots/protoMatch.ts used by Phase B.
//
// Idempotent: upserts on (clusterKey, method), refreshing member/occurrence/
// suggestion fields but NEVER `status` — a moderator's approve/reject
// survives re-running this script, same reimport-safety idiom as
// CorpusCandidateProposal.
//
// Usage:
//   npx tsx scripts/roots-discovery/discover-new-roots.ts

import * as path from "path"
import type { prismaData as PrismaData } from "@/lib/prisma"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`

const MIN_CLUSTER_SIZE = 2
const SUBSTRING_BUCKET_PREFIX_LEN = 3
const SUBSTRING_MIN_RATIO = 0.7
const MAX_EXAMPLE_LEXEMES = 5

interface LexemeLite {
  id: number
  value: string
}

async function main() {
  const { prismaData: db } = await import("@/lib/prisma")
  const { loadKnownAffixes } = await import("@/lib/roots/knownAffixes")
  const { stripKnownAffixes } = await import("@/lib/roots/stripAffixes")
  const { findRootCandidates } = await import("@/lib/roots/substringMiner")
  const { buildProtoIndex, matchRootToProto } = await import("@/lib/roots/protoMatch")

  console.log("Loading known affixes and Proto-Slavic index...")
  const known = await loadKnownAffixes(db)
  const protoIndex = await buildProtoIndex(db)
  const affixSet = new Set([...known.prefixes, ...known.suffixes])

  console.log("Loading unlinked lexemes...")
  const unlinked = await db.lexeme.findMany({
    where: { value: { not: null }, lexemes_morphemes: { none: { morpheme: { type: 0 } } } },
    select: { id: true, value: true },
  })
  const orphans: LexemeLite[] = unlinked
    .filter((l): l is { id: number; value: string } => !!l.value && !affixSet.has(l.value.toLowerCase()))
    // A handful of lexeme values start with a literal "!" or other non-letter
    // marker (data-quality artifacts, e.g. "!crnica") — excluded so they
    // don't leak a stray punctuation character into a proposed root value.
    .filter((l) => /^\p{L}/u.test(l.value))
  console.log(`${unlinked.length} lexemes have no root link (${orphans.length} after excluding bare-affix words).\n`)

  // --- Method 1: affix-strip clustering ---
  const stemClusters = new Map<string, { members: LexemeLite[]; strippedPrefix?: string; strippedSuffix?: string }>()
  const residuals: LexemeLite[] = []

  for (const lex of orphans) {
    const stripped = stripKnownAffixes(lex.value, known)
    if (!stripped) {
      residuals.push(lex)
      continue
    }
    const existing = stemClusters.get(stripped.stem)
    if (existing) existing.members.push(lex)
    else stemClusters.set(stripped.stem, { members: [lex], strippedPrefix: stripped.strippedPrefix, strippedSuffix: stripped.strippedSuffix })
  }

  let affixStripProposed = 0
  let affixStripSingletons = 0
  for (const [stem, cluster] of stemClusters) {
    if (cluster.members.length < MIN_CLUSTER_SIZE) {
      affixStripSingletons++
      continue
    }
    affixStripProposed++
    await upsertProposal(db, {
      clusterKey: stem,
      proposedValue: stem,
      method: "affix_strip",
      strippedPrefix: cluster.strippedPrefix ?? null,
      strippedSuffix: cluster.strippedSuffix ?? null,
      members: cluster.members,
    })
    const proto = matchRootToProto(stem, protoIndex)
    await attachProtoSuggestion(db, stem, "affix_strip", proto)
  }

  // --- Method 2: raw substring fallback for residuals ---
  const buckets = new Map<string, LexemeLite[]>()
  for (const lex of residuals) {
    const v = lex.value.toLowerCase()
    if (v.length < SUBSTRING_BUCKET_PREFIX_LEN) continue
    const key = v.slice(0, SUBSTRING_BUCKET_PREFIX_LEN)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(lex)
    else buckets.set(key, [lex])
  }

  let substringProposed = 0
  let substringBucketsSkipped = 0
  for (const [, bucket] of buckets) {
    if (bucket.length < MIN_CLUSTER_SIZE) continue
    const { candidates, primary } = findRootCandidates(bucket.map((l) => l.value))
    if (!primary) {
      substringBucketsSkipped++
      continue
    }
    const primaryCandidate = candidates.find((c) => c.substring === primary)
    if (!primaryCandidate || primaryCandidate.ratio <= SUBSTRING_MIN_RATIO) {
      substringBucketsSkipped++
      continue
    }
    const members = bucket.filter((l) => l.value.toLowerCase().includes(primary))
    if (members.length < MIN_CLUSTER_SIZE) {
      substringBucketsSkipped++
      continue
    }
    substringProposed++
    await upsertProposal(db, {
      clusterKey: primary,
      proposedValue: primary,
      method: "raw_substring_fallback",
      strippedPrefix: null,
      strippedSuffix: null,
      members,
    })
    const proto = matchRootToProto(primary, protoIndex)
    await attachProtoSuggestion(db, primary, "raw_substring_fallback", proto)
  }

  console.log(`\n--- Done ---`)
  console.log(`Orphan lexemes considered: ${orphans.length}`)
  console.log(`affix_strip: ${affixStripProposed} clusters proposed, ${affixStripSingletons} singleton residuals left unproposed`)
  console.log(`raw_substring_fallback: ${substringProposed} clusters proposed (from ${residuals.length} residual lexemes with no known-affix decomposition), ${substringBucketsSkipped} buckets skipped (no cohesive substring above ${SUBSTRING_MIN_RATIO})`)

  await db.$disconnect()
}

async function upsertProposal(
  db: typeof PrismaData,
  args: {
    clusterKey: string
    proposedValue: string
    method: string
    strippedPrefix: string | null
    strippedSuffix: string | null
    members: LexemeLite[]
  }
) {
  const memberLexemeIds = args.members.map((m) => m.id)
  const exampleLexemeIds = args.members.slice(0, MAX_EXAMPLE_LEXEMES).map((m) => ({ id: m.id, value: m.value }))

  console.log(`[${args.method}] "${args.clusterKey}" — ${args.members.length} members (e.g. ${args.members.slice(0, 3).map((m) => m.value).join(", ")})`)

  // memberLexemeIds/exampleLexemeIds are Prisma `Json` columns — pass the
  // raw array/object and let Prisma serialize it. Passing an
  // already-JSON.stringify()'d string here double-encodes it (Prisma then
  // serializes *that string* as the JSON value), so a read back out
  // returns a string instead of an array — this was exactly the
  // `exampleLexemeIds.map is not a function` bug in production.
  await db.rootDiscoveryProposal.upsert({
    where: { clusterKey_method: { clusterKey: args.clusterKey, method: args.method } },
    update: {
      proposedValue: args.proposedValue,
      strippedPrefix: args.strippedPrefix,
      strippedSuffix: args.strippedSuffix,
      memberLexemeIds,
      occurrenceCount: memberLexemeIds.length,
      exampleLexemeIds,
      lastSeenAt: new Date(),
    },
    create: {
      clusterKey: args.clusterKey,
      proposedValue: args.proposedValue,
      method: args.method,
      strippedPrefix: args.strippedPrefix,
      strippedSuffix: args.strippedSuffix,
      memberLexemeIds,
      occurrenceCount: memberLexemeIds.length,
      exampleLexemeIds,
    },
  })
}

async function attachProtoSuggestion(
  db: typeof PrismaData,
  clusterKey: string,
  method: string,
  proto: { protoSlavicWordId: number; score: number } | null
) {
  if (!proto) return
  await db.rootDiscoveryProposal.update({
    where: { clusterKey_method: { clusterKey, method } },
    data: { protoSuggestionId: proto.protoSlavicWordId, protoSuggestionScore: proto.score },
  })
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
