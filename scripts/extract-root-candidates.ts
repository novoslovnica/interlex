import * as path from 'path'
import fs from 'fs'

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), 'interlex.db')}`

interface RootCandidate {
  substring: string
  matchCount: number
  totalWords: number
  ratio: number
}

interface RootResult {
  id: number
  primaryRoot: string | null
  rootCandidates: RootCandidate[]
}

function extractSubstrings(value: string, minLen = 3): Set<string> {
  const result = new Set<string>()
  const v = value.toLowerCase()
  for (let i = 0; i < v.length; i++) {
    for (let j = i + minLen; j <= v.length; j++) {
      result.add(v.slice(i, j))
    }
  }
  return result
}

function findRootCandidates(words: string[]): { candidates: RootCandidate[]; primary: string | null } {
  const filtered = words.filter(w => w && w.length >= 3)
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
      const best = candidates.find(c => c.ratio > 0.7)
      primary = best ? best.substring : candidates[0].substring
    }
  }

  return { candidates, primary }
}

async function main() {
  const { prismaData: db } = await import('@/lib/prisma')

  const roots = await db.morpheme.findMany({
    select: {
      id: true,
      value: true,
      lexemes_morphemes: {
        select: {
          lexeme: {
            select: { value: true },
          },
        },
      },
    },
  })

  const results: RootResult[] = []

  for (const root of roots) {
    const words = root.lexemes_morphemes
      .flatMap(rw => {
        const v = rw.lexeme?.value
        return v ? v.split(/\s+/).filter(Boolean) : []
      })
      .filter((v): v is string => !!v)

    const unique = [...new Set(words)]

    if (unique.length === 0) {
      results.push({ id: root.id, primaryRoot: null, rootCandidates: [] })
      continue
    }

    const { candidates, primary } = findRootCandidates(unique)
    results.push({ id: root.id, primaryRoot: primary, rootCandidates: candidates })
  }

  const outputPath = path.resolve(process.cwd(), 'root-candidates.json')
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')
  console.error(`Done. Processed ${roots.length} roots. Output: ${outputPath}`)

  await db.$disconnect()
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})