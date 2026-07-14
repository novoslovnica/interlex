import { prismaData as dbData } from "@/lib/prisma"
import Database from "better-sqlite3"
import { NextRequest, NextResponse } from "next/server"

interface LangRecord {
    id: number
    value: string | null
    veryfied: number | null
    wordId: number | null
    meaningId: number | null
}

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids") || ""
  const lang = req.nextUrl.searchParams.get("lang") || "ru"
  const wordIds = ids.split(",").map(Number).filter(Boolean)

  if (!wordIds.length) {
    return NextResponse.json([])
  }

  const words = await dbData.lexeme.findMany({
    where: { id: { in: wordIds } },
    include: {
      meanings: true,
    },
  })

  const meaningIds = words.flatMap(w => w.meanings.map(m => m.id)).filter(Boolean)

  if (meaningIds.length > 0) {
    const db = new Database(process.env.SQLITE_DB!)
    const placeholders = meaningIds.map(() => '?').join(", ")
    const rows = db.prepare(
      `SELECT * FROM ${lang} WHERE meaningId IN (${placeholders})`
    ).all(...meaningIds) as LangRecord[]

    const transByMeaning: Record<number, LangRecord[]> = {}
    for (const row of rows) {
      if (row.meaningId == null) continue
      if (!transByMeaning[row.meaningId]) transByMeaning[row.meaningId] = []
      transByMeaning[row.meaningId].push(row)
    }

    for (const word of words) {
      const wordTranslations: string[] = []
      for (const meaning of word.meanings) {
        const entries = transByMeaning[meaning.id]
        if (entries) {
          for (const e of entries) {
            if (e.value) wordTranslations.push(e.value)
          }
        }
      }
      ;(word as any).translation = wordTranslations.join(", ")
    }

    db.close()
  } else {
    for (const word of words) {
      ;(word as any).translation = ""
    }
  }

  return NextResponse.json(words)
}