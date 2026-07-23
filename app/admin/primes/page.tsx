import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth, prismaData as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import { PrimesClient } from "./primes-client"
import AdminNav from "@/components/AdminNav"
import type { Metadata } from "next"
import { logAudit } from "@/lib/audit-log"

export const metadata: Metadata = {
  title: "Семантические праймы",
  description: "Привязка межславянских значений к семантическим праймам NSM (Goddard 2011).",
}

export interface PrimeItem {
  code: string
  category: string | null
  englishText: string
  sortOrder: number
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

export default async function AdminPrimesPage() {
  const session = await auth()
  if (!session) redirect("/unauthorized")

  await requirePermission(session, Feature.SemanticPrimesManage)

  const userPermissions = session.user.role === "MODERATOR"
    ? (await dbAuth.featurePermission.findMany({
        where: { userId: session.user.id },
        select: { featureKey: true },
      })).map((p) => p.featureKey)
    : []

  const primes = await db.semanticPrime.findMany({
    orderBy: { sortOrder: "asc" },
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

  const initialPrimes: PrimeItem[] = primes.map((p) => ({
    code: p.code,
    category: p.category,
    englishText: p.englishText,
    sortOrder: p.sortOrder,
    exponents: p.exponents.map((e) => ({
      id: e.id,
      isCanonical: e.isCanonical,
      note: e.note,
      meaning: e.meaning,
    })),
  }))

  async function updateExponents(primeCode: string, meaningIds: number[]) {
    "use server"

    const existing = await db.primeExponent.findMany({
      where: { primeCode },
      select: { id: true, meaningId: true },
    })
    const existingIds = new Set(existing.map((e) => e.meaningId))
    const targetIds = new Set(meaningIds)

    const toRemove = existing.filter((e) => !targetIds.has(e.meaningId))
    const toAdd = meaningIds.filter((id) => !existingIds.has(id))

    if (toRemove.length > 0) {
      await db.primeExponent.deleteMany({ where: { id: { in: toRemove.map((r) => r.id) } } })
    }
    if (toAdd.length > 0) {
      await db.primeExponent.createMany({
        data: toAdd.map((meaningId) => ({ primeCode, meaningId })),
      })
    }

    if (toRemove.length > 0 || toAdd.length > 0) {
      const affectedMeanings = await db.meaning.findMany({
        where: { id: { in: [...toRemove.map((r) => r.meaningId), ...toAdd] } },
        select: { id: true, lexemeId: true },
      })
      for (const m of affectedMeanings) {
        await logAudit(session?.user, "Lexeme", m.lexemeId, [
          { field: `primeExponent:${primeCode}`, oldValue: existingIds.has(m.id) ? m.id : null, newValue: targetIds.has(m.id) ? m.id : null },
        ])
      }
    }
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <div className="flex flex-col h-full overflow-hidden">
        <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
        <div className="px-4 md:px-6 pb-2 shrink-0">
          <h1 className="text-2xl font-bold">Семантические праймы (NSM)</h1>
          <p className="text-muted-foreground text-sm">
            Выберите прайм слева, затем найдите и привяжите межславянское значение, которое является его экспонентом.
            Сам список 64 праймов — фиксированный справочник (Goddard 2011), не редактируется здесь.
          </p>
        </div>
        <div className="flex-1 min-h-0 px-4 md:px-6 overflow-hidden">
          <PrimesClient initialPrimes={initialPrimes} onUpdateExponents={updateExponents} />
        </div>
      </div>
    </div>
  )
}
