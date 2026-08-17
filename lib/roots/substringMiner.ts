// Extracted from scripts/extract-root-candidates.ts so both that standalone
// script and scripts/roots-discovery/discover-new-roots.ts (the residual,
// no-known-affix-decomposition fallback pass, see stripAffixes.ts) share one
// implementation instead of duplicating it. Logic unchanged from the
// original script — raw longest-common-substring frequency mining, with no
// affix awareness, which is why it's used only as an explicitly
// lower-confidence fallback (method='raw_substring_fallback') rather than
// the primary clustering method.

export interface RootCandidate {
  substring: string
  matchCount: number
  totalWords: number
  ratio: number
}

export function extractSubstrings(value: string, minLen = 3): Set<string> {
  const result = new Set<string>()
  const v = value.toLowerCase()
  for (let i = 0; i < v.length; i++) {
    for (let j = i + minLen; j <= v.length; j++) {
      result.add(v.slice(i, j))
    }
  }
  return result
}

export function findRootCandidates(words: string[]): { candidates: RootCandidate[]; primary: string | null } {
  const filtered = words.filter((w) => w && w.length >= 3)
  if (filtered.length === 0) return { candidates: [], primary: null }

  const totalWords = filtered.length
  const substringCount = new Map<string, number>()

  for (const word of filtered) {
    const substrings = extractSubstrings(word)
    for (const sub of substrings) {
      substringCount.set(sub, (substringCount.get(sub) || 0) + 1)
    }
  }

  const candidates: RootCandidate[] = []
  for (const [substring, matchCount] of substringCount) {
    const ratio = matchCount / totalWords
    candidates.push({ substring, matchCount, totalWords, ratio })
  }

  candidates.sort((a, b) => {
    if (b.ratio !== a.ratio) return b.ratio - a.ratio
    if (b.substring.length !== a.substring.length) return b.substring.length - a.substring.length
    return a.substring.localeCompare(b.substring)
  })

  let primary: string | null = null
  if (candidates.length > 0) {
    if (totalWords <= 2) {
      primary = candidates[0].substring
    } else {
      const best = candidates.find((c) => c.ratio > 0.7)
      primary = best ? best.substring : candidates[0].substring
    }
  }

  return { candidates, primary }
}
