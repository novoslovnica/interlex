import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth, prismaData as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import { RelationClient } from "./_components/relation-client"
import AdminNav from "@/components/AdminNav"
import type { Metadata } from "next"
import { logAudit } from "@/lib/audit-log"
import { RELATION_CONFIG, isValidRelationType, type RelationType } from "../relation-config"
import { init } from "@/lib/sqlite"
import {
  fetchSymmetricSemanticRelations,
  saveSymmetricSemanticRelation,
  fetchOutgoingSemanticRelations,
  fetchIncomingSemanticRelations,
  saveDirectionalSemanticRelation,
} from "@/lib/relations"

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params
  if (!isValidRelationType(type)) return { title: "Неизвестный тип" }
  const cfg = RELATION_CONFIG[type]
  return {
    title: cfg.label,
    description: cfg.description,
  }
}

export interface WordItem {
  id: number
  value: string | null
  meanings: {
    id: number
    meaning: string | null
    relations: {
      id: number
      proximity: number | null
      target: {
        id: number
        meaning: string | null
        lexeme: { id: number; value: string | null }
      }
    }[]
  }[]
}

export default async function AdminRelationsPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  if (!isValidRelationType(type)) redirect("/admin")

  const cfg = RELATION_CONFIG[type]

  const session = await auth()
  if (!session) redirect("/unauthorized")

  await requirePermission(session, cfg.featureKey as Feature)

  const userPermissions = session.user.role === "MODERATOR"
    ? (await dbAuth.featurePermission.findMany({
        where: { userId: session.user.id },
        select: { featureKey: true },
      })).map(p => p.featureKey)
    : []

  const dbSimple = await init()
  const baseRows = dbSimple.prepare(`
    SELECT l.id AS wordId, l.value AS wordValue, m.id AS meaningId, m.meaning AS meaningText
    FROM lexemes l
    JOIN meanings m ON m.lexemeId = l.id
    ORDER BY l.value ASC
    LIMIT 30
  `).all() as { wordId: number; wordValue: string | null; meaningId: number; meaningText: string | null }[]

  const wordMap = new Map<number, WordItem>()
  const meaningIds: number[] = []
  for (const row of baseRows) {
    if (!wordMap.has(row.wordId)) {
      wordMap.set(row.wordId, { id: row.wordId, value: row.wordValue, meanings: [] })
    }
    wordMap.get(row.wordId)!.meanings.push({ id: row.meaningId, meaning: row.meaningText, relations: [] })
    meaningIds.push(row.meaningId)
  }

  const relationsByMeaning = cfg.direction === "outgoing"
    ? fetchOutgoingSemanticRelations(dbSimple, cfg.relationType, meaningIds)
    : cfg.direction === "incoming"
      ? fetchIncomingSemanticRelations(dbSimple, cfg.relationType, meaningIds)
      : fetchSymmetricSemanticRelations(dbSimple, cfg.relationType, meaningIds)
  for (const word of wordMap.values()) {
    for (const meaning of word.meanings) {
      const related = relationsByMeaning.get(meaning.id) || []
      meaning.relations = related.map((r) => ({
        id: r.relationId,
        proximity: r.proximity,
        target: {
          id: r.otherMeaningId,
          meaning: r.otherMeaning,
          lexeme: { id: r.otherWordId ?? 0, value: r.otherWord },
        },
      }))
    }
  }
  const initialWords = Array.from(wordMap.values())

  async function updateRelations(sourceMeaningId: number, targetMeaningIds: number[]) {
    "use server"

    if (cfg.direction === "outgoing" || cfg.direction === "incoming") {
      saveDirectionalSemanticRelation(dbSimple, cfg.relationType, sourceMeaningId, cfg.direction, targetMeaningIds, 1.0)
    } else {
      saveSymmetricSemanticRelation(dbSimple, cfg.relationType, sourceMeaningId, targetMeaningIds, 1.0)
    }

    const meaning = await db.meaning.findUnique({
      where: { id: sourceMeaningId },
      select: { lexeme: { select: { id: true } } }
    })
    if (meaning?.lexeme) {
      await logAudit(session?.user, "Lexeme", meaning.lexeme.id, [
        { field: `${type}_sourceMeaningId`, oldValue: null, newValue: sourceMeaningId },
        { field: `${type}_targetMeaningIds`, oldValue: null, newValue: targetMeaningIds },
      ])
    }
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <div className="flex flex-col h-full overflow-hidden">
        <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
        <div className="px-4 md:px-6 pb-2 shrink-0">
          <h1 className="text-2xl font-bold">Управление {cfg.label.toLowerCase()}</h1>
          <p className="text-muted-foreground text-sm">
            Выберите слово, затем его значение, чтобы {cfg.description}.
          </p>
        </div>
        <div className="flex-1 min-h-0 px-4 md:px-6 overflow-hidden">
          <RelationClient
            type={type}
            initialWords={initialWords}
            onUpdateRelations={updateRelations}
          />
        </div>
      </div>
    </div>
  )
}