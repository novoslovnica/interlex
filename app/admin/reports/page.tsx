import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth, prismaData } from "@/lib/prisma"
import AdminNav from "@/components/AdminNav"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import ReportsClient, { ReportDTO } from "./reports-client"

export const metadata: Metadata = {
  title: "Жалобы на ошибки | Админ-панель",
  description: "Модерация публичных жалоб 'сообщить об ошибке' с карточек слов.",
}

const PAGE_SIZE = 20

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.ReportsReview)

  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)

  const [reports, total, userPermissions] = await Promise.all([
    prismaData.contentReport.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prismaData.contentReport.count({ where: { status: "pending" } }),
    session.user.role === "MODERATOR"
      ? dbAuth.featurePermission
          .findMany({ where: { userId: session.user.id }, select: { featureKey: true } })
          .then((rows) => rows.map((p) => p.featureKey))
      : Promise.resolve([]),
  ])

  const lexemeIds = [...new Set(reports.map((r) => r.lexemeId))]
  const submitterIds = [...new Set(reports.map((r) => r.submitterUserId).filter((id): id is string => !!id))]

  const [lexemes, submitters] = await Promise.all([
    lexemeIds.length > 0
      ? prismaData.lexeme.findMany({ where: { id: { in: lexemeIds } }, select: { id: true, value: true } })
      : Promise.resolve([]),
    submitterIds.length > 0
      ? dbAuth.user.findMany({ where: { id: { in: submitterIds } }, select: { id: true, email: true, name: true } })
      : Promise.resolve([]),
  ])

  const lexemeById = new Map(lexemes.map((l) => [l.id, l.value]))
  const submitterById = new Map(submitters.map((u) => [u.id, u.email || u.name || u.id]))

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const dtos: ReportDTO[] = reports.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    entityType: r.entityType,
    entityId: r.entityId,
    lexemeId: r.lexemeId,
    lexemeValue: lexemeById.get(r.lexemeId) ?? null,
    field: r.field,
    reportedValue: r.reportedValue,
    reasonCode: r.reasonCode,
    comment: r.comment,
    submitter: r.submitterUserId ? (submitterById.get(r.submitterUserId) ?? r.submitterUserId) : (r.submitterContact ?? null),
  }))

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
      <ReportsClient reports={dtos} page={page} totalPages={totalPages} total={total} />
    </div>
  )
}
