import type { KnownAffixes } from "./knownAffixes"

// Residual stems shorter than this are too ambiguous to cluster on reliably
// (e.g. stripping "za" from a 4-letter word could leave a 2-letter stem that
// coincidentally matches many unrelated words).
const MIN_STEM_LEN = 3

export interface StripResult {
  stem: string
  strippedPrefix?: string
  strippedSuffix?: string
}

// Single-pass, longest-match-first prefix strip then suffix strip —
// deliberately NOT iterative/greedy. Stripping more than one affix layer per
// side is exactly the kind of unchecked greediness that let a shared prefix
// ("pri") contaminate an entire root nest (181 unrelated lexemes clustered
// under a fake root just because they all start with "pri-") — see
// AGENTS.md's root-morpheme cleanup notes. Staying conservative here trades
// some recall for not reproducing that bug.
export function stripKnownAffixes(rawValue: string, known: KnownAffixes): StripResult | null {
  const value = rawValue.toLowerCase().trim()
  if (!value) return null
  // The word itself IS an affix (a bound morpheme, not a root-bearing lexeme) — never a root candidate.
  if (known.prefixes.includes(value) || known.suffixes.includes(value)) return null

  let stem = value
  let strippedPrefix: string | undefined
  let strippedSuffix: string | undefined

  for (const p of known.prefixes) {
    if (stem.startsWith(p) && stem.length - p.length >= MIN_STEM_LEN) {
      strippedPrefix = p
      stem = stem.slice(p.length)
      break
    }
  }
  for (const s of known.suffixes) {
    if (stem.endsWith(s) && stem.length - s.length >= MIN_STEM_LEN) {
      strippedSuffix = s
      stem = stem.slice(0, -s.length)
      break
    }
  }

  if (!strippedPrefix && !strippedSuffix) return null // nothing decomposed — caller falls back to the raw substring miner
  if (stem.length < MIN_STEM_LEN) return null

  return { stem, strippedPrefix, strippedSuffix }
}
