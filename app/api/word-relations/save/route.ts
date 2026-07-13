import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { init } from "@/lib/sqlite"

const TABLE_MAP: Record<string, string> = {
  synonyms: "synonyms",
  antonyms: "antonyms",
  hypernyms: "hypernyms",
  hyponyms: "hyponyms",
  meronyms: "meronyms",
  holonyms: "holonyms",
  "related-words": "related_words",
  causes: "causes",
  effects: "effects",
  premises: "premises",
  conclusions: "conclusions",
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { type, sourceMeaningId, targetMeaningIds } = body as {
    type: string
    sourceMeaningId: number
    targetMeaningIds: number[]
  }

  const tableName = TABLE_MAP[type]
  if (!tableName) return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  if (!sourceMeaningId) return NextResponse.json({ error: "Missing sourceMeaningId" }, { status: 400 })

  const db = await init()

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM ${tableName} WHERE sourceId = ?`).run(sourceMeaningId)
    if (targetMeaningIds.length > 0) {
      const insert = db.prepare(`INSERT INTO ${tableName} (sourceId, targetId) VALUES (?, ?)`)
      for (const tId of targetMeaningIds) {
        insert.run(sourceMeaningId, tId)
      }
    }
  })
  tx()

  return NextResponse.json({ success: true })
}