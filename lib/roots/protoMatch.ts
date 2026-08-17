import { levenshtein } from "@/lib/levenshtein"
import { normalizeProtoLemma, normalizeRootValueForMatching } from "@/lib/proto"
import type { prismaData } from "@/lib/prisma"

export interface ProtoWordLite {
  id: number
  lemma: string
}

export interface ProtoMatchResult {
  protoSlavicWordId: number
  score: number
  /** true only for a single, unique, distance-0 match — the auto-apply-eligible case */
  exactUnique: boolean
  /** number of other proto_slavic_words rows that also normalize to the same value (ties, exact match only) */
  tieCount: number
}

const MIN_FUZZY_SCORE = 0.55

export interface ProtoIndex {
  /** normalized lemma -> all proto words that normalize to it (for exact + tie detection) */
  exactMap: Map<string, ProtoWordLite[]>
  /** first char of normalized lemma -> proto words (fuzzy search bucket, keeps Levenshtein off the full 24k set) */
  byFirstChar: Map<string, ProtoWordLite[]>
}

/** Builds the lookup structures once per script run over the full proto_slavic_words table. */
export async function buildProtoIndex(db: typeof prismaData): Promise<ProtoIndex> {
  const rows = await db.protoSlavicWord.findMany({ select: { id: true, lemma: true } })

  const exactMap = new Map<string, ProtoWordLite[]>()
  const byFirstChar = new Map<string, ProtoWordLite[]>()

  for (const row of rows) {
    const normalized = normalizeProtoLemma(row.lemma)
    if (!normalized) continue
    const entry: ProtoWordLite = { id: row.id, lemma: row.lemma }

    const exactBucket = exactMap.get(normalized)
    if (exactBucket) exactBucket.push(entry)
    else exactMap.set(normalized, [entry])

    const firstChar = normalized[0]
    const charBucket = byFirstChar.get(firstChar)
    if (charBucket) charBucket.push(entry)
    else byFirstChar.set(firstChar, [entry])
  }

  return { exactMap, byFirstChar }
}

/**
 * Scores a root value against the proto index. Exact (distance-0 after
 * normalization) matches are checked first and short-circuit the fuzzy
 * path. A single exact hit is auto-apply eligible (exactUnique=true); 2+
 * exact hits means several ESSJa entries normalize to the same root
 * (dialectal variants/homonyms) — always review-queued, never auto-applied.
 * Fuzzy fallback is bucketed by first normalized letter to avoid an
 * O(roots × 24,531) Levenshtein sweep; every fuzzy result is human-reviewed
 * regardless of score, so the recall trade-off from bucketing is acceptable.
 */
export function matchRootToProto(rootValue: string, index: ProtoIndex): ProtoMatchResult | null {
  const normalizedRoot = normalizeRootValueForMatching(rootValue)
  if (!normalizedRoot) return null

  const exactBucket = index.exactMap.get(normalizedRoot)
  if (exactBucket && exactBucket.length > 0) {
    return {
      protoSlavicWordId: exactBucket[0].id,
      score: 1,
      exactUnique: exactBucket.length === 1,
      tieCount: exactBucket.length - 1,
    }
  }

  const bucket = index.byFirstChar.get(normalizedRoot[0]) ?? []
  let best: { entry: ProtoWordLite; score: number } | null = null
  for (const entry of bucket) {
    const normalizedLemma = normalizeProtoLemma(entry.lemma)
    if (!normalizedLemma) continue
    const maxLen = Math.max(normalizedRoot.length, normalizedLemma.length)
    if (maxLen === 0) continue
    const score = 1 - levenshtein(normalizedRoot, normalizedLemma) / maxLen
    if (!best || score > best.score) best = { entry, score }
  }

  if (!best || best.score < MIN_FUZZY_SCORE) return null
  return { protoSlavicWordId: best.entry.id, score: best.score, exactUnique: false, tieCount: 0 }
}
