import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth, prismaData as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import { CoreVocabularyClient } from "./core-vocabulary-client"
import AdminNav from "@/components/AdminNav"
import type { Metadata } from "next"
import { logAudit } from "@/lib/audit-log"

export const metadata: Metadata = {
  title: "Базовая лексика",
  description: "Привязка межславянских значений к понятиям из списков Сводеша-100 и Лейпциг-Джакарта.",
}

export interface CoreVocabularyConceptItem {
  id: number
  gloss: string
  swadesh100Rank: number | null
  leipzigJakartaRank: number | null
  exponents: {
    id: number
    isCanonical: boolean
    note: string | null
    meaning: {
      id: number
      meaning: string | null
      lexeme: { id: number; value: string | null }
    }
  }[]
}

export default async function AdminCoreVocabularyPage() {
  const session = await auth()
  if (!session) redirect("/unauthorized")

  await requirePermission(session, Feature.CoreVocabularyManage)

  const userPermissions = session.user.role === "MODERATOR"
    ? (await dbAuth.featurePermission.findMany({
        where: { userId: session.user.id },
        select: { featureKey: true },
      })).map((p) => p.featureKey)
    : []

  const concepts = await db.coreVocabularyConcept.findMany({
    include: {
      exponents: {
        include: {
          meaning: {
            select: {
              id: true,
              meaning: true,
              lexeme: { select: { id: true, value: true } },
            },
          },
        },
      },
    },
  })

  const initialConcepts: CoreVocabularyConceptItem[] = concepts
    .map((c) => ({
      id: c.id,
      gloss: c.gloss,
      swadesh100Rank: c.swadesh100Rank,
      leipzigJakartaRank: c.leipzigJakartaRank,
      exponents: c.exponents.map((e) => ({
        id: e.id,
        isCanonical: e.isCanonical,
        note: e.note,
        meaning: e.meaning,
      })),
    }))
    .sort((a, b) => {
      const rankA = Math.min(a.swadesh100Rank ?? Infinity, a.leipzigJakartaRank ?? Infinity)
      const rankB = Math.min(b.swadesh100Rank ?? Infinity, b.leipzigJakartaRank ?? Infinity)
      return rankA - rankB
    })

  async function updateExponents(conceptId: number, meaningIds: number[]) {
    "use server"

    const existing = await db.coreVocabularyExponent.findMany({
      where: { conceptId },
      select: { id: true, meaningId: true },
    })
    const existingIds = new Set(existing.map((e) => e.meaningId))
    const targetIds = new Set(meaningIds)

    const toRemove = existing.filter((e) => !targetIds.has(e.meaningId))
    const toAdd = meaningIds.filter((id) => !existingIds.has(id))

    if (toRemove.length > 0) {
      await db.coreVocabularyExponent.deleteMany({ where: { id: { in: toRemove.map((r) => r.id) } } })
    }
    if (toAdd.length > 0) {
      await db.coreVocabularyExponent.createMany({
        data: toAdd.map((meaningId) => ({ conceptId, meaningId })),
      })
    }

    if (toRemove.length > 0 || toAdd.length > 0) {
      const affectedMeanings = await db.meaning.findMany({
        where: { id: { in: [...toRemove.map((r) => r.meaningId), ...toAdd] } },
        select: { id: true, lexemeId: true },
      })
      for (const m of affectedMeanings) {
        await logAudit(session?.user, "Lexeme", m.lexemeId, [
          { field: `coreVocabularyExponent:${conceptId}`, oldValue: existingIds.has(m.id) ? m.id : null, newValue: targetIds.has(m.id) ? m.id : null },
        ])
      }
    }
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <div className="flex flex-col h-full overflow-hidden">
        <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
        <div className="px-4 md:px-6 pb-2 shrink-0">
          <h1 className="text-2xl font-bold">Базовая лексика</h1>
          <p className="text-muted-foreground text-sm">
            Выберите понятие слева, затем найдите и привяжите межславянское значение, которое является его
            экспонентом. Сами списки — фиксированные справочники (Сводеш-100, Лейпциг-Джакарта), не редактируются
            здесь; понятие, входящее в оба списка, показывается одной строкой с двумя рангами.
          </p>
        </div>
        <div className="flex-1 min-h-0 px-4 md:px-6 overflow-hidden">
          <CoreVocabularyClient initialConcepts={initialConcepts} onUpdateExponents={updateExponents} />
        </div>
      </div>
    </div>
  )
}
