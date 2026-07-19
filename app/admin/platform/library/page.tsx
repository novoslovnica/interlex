import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prismaLibrary as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { DeleteButton } from "./_components/DeleteButton"
import { getFlavorLabel } from "@/config/flavor"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Библиотека — администрирование",
  description: "Управление текстами библиотеки межславянского языка.",
}

export default async function AdminLibraryPage() {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.LibraryManage)

  const userPermissions = session.user.role === "MODERATOR"
    ? (await dbAuth.featurePermission.findMany({
        where: { userId: session.user.id },
        select: { featureKey: true },
      })).map(p => p.featureKey)
    : []

  const entries = await db.libraryEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { children: true } } },
  })

  async function deleteEntry(formData: FormData) {
    "use server"
    const s = await auth()
    if (!s) throw new Error("Unauthorized")
    await requirePermission(s, Feature.LibraryManage)
    const id = parseInt(formData.get("id") as string, 10)
    await db.libraryEntry.delete({ where: { id } })
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Библиотека</h1>
          <Link
            href="/admin/platform/library/new"
            className="px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            + Добавить текст
          </Link>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Название</th>
                <th className="text-left px-3 py-2 font-medium">Автор</th>
                <th className="text-left px-3 py-2 font-medium">Žanr</th>
                <th className="text-left px-3 py-2 font-medium">Tematika</th>
                <th className="text-left px-3 py-2 font-medium">Flavorizacija</th>
                <th className="text-left px-3 py-2 font-medium">Год</th>
                <th className="text-left px-3 py-2 font-medium">Переводчик</th>
                <th className="text-left px-3 py-2 font-medium">Добавил</th>
                <th className="text-center px-3 py-2 font-medium">Аудио</th>
                <th className="text-center px-3 py-2 font-medium">Публично</th>
                <th className="text-center px-3 py-2 font-medium">Детей</th>
                <th className="text-center px-3 py-2 font-medium">Проверено</th>
                <th className="text-right px-3 py-2 font-medium">Просмотры</th>
                <th className="text-right px-3 py-2 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground text-sm">
                    В библиотеке пока нет текстов
                  </td>
                </tr>
              )}
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium max-w-[200px] truncate" title={entry.title}>{entry.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.author || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.genre}</td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.topic || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{getFlavorLabel(entry.flavor)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {entry.yearWritten ? (entry.yearTranslated ? `${entry.yearWritten}→${entry.yearTranslated}` : entry.yearWritten) : (entry.yearTranslated ? entry.yearTranslated : "—")}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.translator || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate" title={entry.addedBy || ""}>{entry.addedBy || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    {entry.audioFile ? <span className="text-lg" title={entry.audioFile}>🎧</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {entry.isPublic ? (
                      <span className="text-green-600 font-bold">✓</span>
                    ) : (
                      <span className="text-red-400 font-bold">✗</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{entry._count.children}</td>
                  <td className="px-3 py-2 text-center">
                    {entry.verified ? (
                      <span className="text-green-600 font-bold">✓</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{entry.views}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Link
                        href={`/admin/platform/library/${entry.id}/edit`}
                        className="px-2 py-1 text-xs rounded border hover:bg-muted transition-colors"
                      >
                        Редактировать
                      </Link>
                      <form action={deleteEntry}>
                        <input type="hidden" name="id" value={entry.id} />
                        <DeleteButton />
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}