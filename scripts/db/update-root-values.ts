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

async function main() {
  const { prismaData: db } = await import('@/lib/prisma')

  const coreFlavor = await db.allophoneFlavor.findUnique({ where: { code: 'CORE' } })
  if (!coreFlavor) {
    console.error('CORE allophone flavor not found. Run fill:db or fill:is:db first.')
    process.exit(1)
  }

  const inputPath = path.resolve(process.cwd(), 'root-candidates.json')
  const data: RootResult[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))

  let updated = 0
  let skipped = 0

  for (const entry of data) {
    if (!entry.primaryRoot) {
      skipped++
      continue
    }

    await db.morpheme.update({
      where: { id: entry.id },
      data: { value: entry.primaryRoot },
    })

    await db.morphemeAllophone.upsert({
      where: { morphemeId_flavorId: { morphemeId: entry.id, flavorId: coreFlavor.id } },
      update: { value: entry.primaryRoot },
      create: { morphemeId: entry.id, value: entry.primaryRoot, flavorId: coreFlavor.id },
    })

    updated++
  }

  console.error(`Updated ${updated} roots, skipped ${skipped} (no primaryRoot)`)
  await db.$disconnect()
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})