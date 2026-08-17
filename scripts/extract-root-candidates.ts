// Superseded by scripts/roots-discovery/discover-new-roots.ts, which reuses
// this file's extractSubstrings/findRootCandidates logic (now shared via
// lib/roots/substringMiner.ts) only as an explicitly lower-confidence
// fallback for lexemes that don't decompose via known affix-stripping. This
// script has no dry-run flag and unconditionally overwrites every root's
// value — unsafe to run again now that roots carry moderator-reviewed
// qualityFlag/protoSuggestion state it would blindly clobber. Kept for git
// history / manual one-off use only.

import * as path from 'path'
import fs from 'fs'
import { findRootCandidates, type RootCandidate } from '@/lib/roots/substringMiner'

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), 'interlex.db')}`

interface RootResult {
  id: number
  primaryRoot: string | null
  rootCandidates: RootCandidate[]
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