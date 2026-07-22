import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prismaData as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import type { Metadata } from "next"
import type { Prisma } from "../../../../prisma/generated/data/client"

export const metadata: Metadata = {
  title: "Аудит — администрирование",
  description: "История изменений тезауруса (Lexeme, Morpheme и т.д.).",
}

const PAGE_SIZE = 50

function formatValue(value: string | null): string {
  if (value === null) return "—"
  return value.length > 80 ? `${value.slice(0, 80)}…` : value
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    entityType?: string
    entityId?: string
    userEmail?: string
  }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.LogsView)

  const { page: pageStr, entityType, entityId, userEmail } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)

  const where: Prisma.AuditLogWhereInput = {}
  if (entityType) where.entityType = entityType
  if (entityId) {
    const parsedEntityId = parseInt(entityId, 10)
    if (!Number.isNaN(parsedEntityId)) where.entityId = parsedEntityId
  }
  if (userEmail) where.userEmail = { contains: userEmail }

  const [entries, total, entityTypes] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams()
    if (entityType) params.set("entityType", entityType)
    if (entityId) params.set("entityId", entityId)
    if (userEmail) params.set("userEmail", userEmail)
    params.set("page", String(targetPage))
    return `/admin/platform/audit-log?${params.toString()}`
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Аудит изменений</h1>
          <span className="text-sm text-muted-foreground">Всего записей: {total}</span>
        </div>

        <form className="flex flex-wrap gap-2 items-end" method="get">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Тип сущности</label>
            <select
              name="entityType"
              defaultValue={entityType ?? ""}
              className="px-2 py-1.5 text-sm rounded border bg-background"
            >
              <option value="">Все</option>
              {entityTypes.map((row) => (
                <option key={row.entityType} value={row.entityType}>
                  {row.entityType}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">ID сущности</label>
            <input
              type="number"
              name="entityId"
              defaultValue={entityId ?? ""}
              className="px-2 py-1.5 text-sm rounded border bg-background w-28"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Email пользователя</label>
            <input
              type="text"
              name="userEmail"
              defaultValue={userEmail ?? ""}
              className="px-2 py-1.5 text-sm rounded border bg-background w-56"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Фильтровать
          </button>
          {(entityType || entityId || userEmail) && (
            <Link
              href="/admin/platform/audit-log"
              className="px-3 py-1.5 text-xs font-medium rounded border hover:bg-muted transition-colors"
            >
              Сбросить
            </Link>
          )}
        </form>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Дата</th>
                <th className="text-left px-3 py-2 font-medium">Пользователь</th>
                <th className="text-left px-3 py-2 font-medium">Сущность</th>
                <th className="text-left px-3 py-2 font-medium">Поле</th>
                <th className="text-left px-3 py-2 font-medium">Старое значение</th>
                <th className="text-left px-3 py-2 font-medium">Новое значение</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-sm">
                    Записей не найдено
                  </td>
                </tr>
              )}
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {entry.createdAt.toLocaleString("ru-RU")}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate" title={entry.userEmail}>
                    {entry.userEmail}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link
                      href={`/admin/platform/audit-log?entityType=${encodeURIComponent(entry.entityType)}&entityId=${entry.entityId}`}
                      className="hover:underline"
                    >
                      {entry.entityType} #{entry.entityId}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.field}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[240px] truncate" title={entry.oldValue ?? undefined}>
                    {formatValue(entry.oldValue)}
                  </td>
                  <td className="px-3 py-2 max-w-[240px] truncate" title={entry.newValue ?? undefined}>
                    {formatValue(entry.newValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Страница {page} из {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={buildPageHref(page - 1)} className="px-2 py-1 rounded border hover:bg-muted transition-colors">
                  ← Назад
                </Link>
              )}
              {page < totalPages && (
                <Link href={buildPageHref(page + 1)} className="px-2 py-1 rounded border hover:bg-muted transition-colors">
                  Вперёд →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
