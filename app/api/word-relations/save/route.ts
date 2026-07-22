import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { init } from "@/lib/sqlite"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { saveSymmetricRelation } from "@/lib/relations"

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

const FEATURE_MAP: Record<string, Feature> = {
  synonyms: Feature.SynonymsEdit,
  antonyms: Feature.AntonymsEdit,
  hypernyms: Feature.HypernymsEdit,
  hyponyms: Feature.HyponymsEdit,
  meronyms: Feature.MeronymsEdit,
  holonyms: Feature.HolonymsEdit,
  "related-words": Feature.RelatedWordsEdit,
  causes: Feature.CausesEdit,
  effects: Feature.EffectsEdit,
  premises: Feature.PremisesEdit,
  conclusions: Feature.ConclusionsEdit,
}

export async function POST(request: Request) {
  const session = await auth()

  const body = await request.json()
  const { type, sourceMeaningId, targetMeaningIds } = body as {
    type: string
    sourceMeaningId: number
    targetMeaningIds: number[]
  }

  const tableName = TABLE_MAP[type]
  const requiredFeature = FEATURE_MAP[type]
  if (!tableName || !requiredFeature) return NextResponse.json({ error: "Unknown type" }, { status: 400 })

  const allowed = (await checkPermission(session, requiredFeature)) || (await checkPermission(session, Feature.RelationsManage))
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!sourceMeaningId) return NextResponse.json({ error: "Missing sourceMeaningId" }, { status: 400 })

  const db = await init()

  saveSymmetricRelation(db, tableName, sourceMeaningId, targetMeaningIds ?? [])

  return NextResponse.json({ success: true })
}