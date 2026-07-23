import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { init } from "@/lib/sqlite"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { saveSymmetricSemanticRelation, saveDirectionalSemanticRelation } from "@/lib/relations"
import { RELATION_CONFIG, isValidRelationType } from "@/app/admin/relations/relation-config"

const FEATURE_MAP: Record<string, Feature> = {
  synonyms: Feature.SynonymsEdit,
  antonyms: Feature.AntonymsEdit,
}

export async function POST(request: Request) {
  const session = await auth()

  const body = await request.json()
  const { type, sourceMeaningId, targetMeaningIds } = body as {
    type: string
    sourceMeaningId: number
    targetMeaningIds: number[]
  }

  const isSynAnt = type === "synonyms" || type === "antonyms"
  const relationCfg = isValidRelationType(type) ? RELATION_CONFIG[type] : null
  if (!isSynAnt && !relationCfg) return NextResponse.json({ error: "Unknown type" }, { status: 400 })

  const requiredFeature = (isSynAnt ? FEATURE_MAP[type] : relationCfg!.featureKey) as Feature
  const allowed = (await checkPermission(session, requiredFeature)) || (await checkPermission(session, Feature.RelationsManage))
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!sourceMeaningId) return NextResponse.json({ error: "Missing sourceMeaningId" }, { status: 400 })

  const db = await init()

  if (isSynAnt) {
    saveSymmetricSemanticRelation(db, type === "synonyms" ? "synonym" : "antonym", sourceMeaningId, targetMeaningIds ?? [])
  } else if (relationCfg!.direction) {
    saveDirectionalSemanticRelation(db, relationCfg!.relationType, sourceMeaningId, relationCfg!.direction, targetMeaningIds ?? [])
  } else {
    saveSymmetricSemanticRelation(db, relationCfg!.relationType, sourceMeaningId, targetMeaningIds ?? [])
  }

  return NextResponse.json({ success: true })
}