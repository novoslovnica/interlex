import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prismaLibrary as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import { DeleteButton } from "./_components/DeleteButton"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Медиатека — администрирование",
  description: "Управление каталогом внешнего аудио/видео-контента (roadmap п.82).",
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  podcast: "Подкаст",
  youtube_channel: "YouTube-канал",
  video: "Видео",
  audio_track: "Аудиозапись",
  other: "Другое",
}

export default async function AdminMediaPage() {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.MediaLibraryManage)

  const entries = await db.mediaLibraryEntry.findMany({
    orderBy: { createdAt: "desc" },
  })

  async function deleteEntry(formData: FormData) {
    "use server"
    const s = await auth()
    if (!s) throw new Error("Unauthorized")
    await requirePermission(s, Feature.MediaLibraryManage)
    const id = parseInt(formData.get("id") as string, 10)
    await db.mediaLibraryEntry.delete({ where: { id } })
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Медиатека</h1>
          <Link
            href="/admin/platform/media/new"
            className="px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            + Добавить запись
          </Link>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Название</th>
                <th className="text-left px-3 py-2 font-medium">Тип</th>
                <th className="text-left px-3 py-2 font-medium">Платформа</th>
                <th className="text-left px-3 py-2 font-medium">Добавил</th>
                <th className="text-center px-3 py-2 font-medium">Публично</th>
                <th className="text-center px-3 py-2 font-medium">Проверено</th>
                <th className="text-right px-3 py-2 font-medium">Просмотры</th>
                <th className="text-right px-3 py-2 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground text-sm">
                    В медиатеке пока нет записей
                  </td>
                </tr>
              )}
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium max-w-[220px] truncate" title={entry.title}>
                    <a href={entry.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {entry.title}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{MEDIA_TYPE_LABELS[entry.mediaType] || entry.mediaType}</td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.platform || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate" title={entry.addedBy || ""}>{entry.addedBy || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    {entry.isPublic ? <span className="text-green-600 font-bold">✓</span> : <span className="text-red-400 font-bold">✗</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {entry.verified ? <span className="text-green-600 font-bold">✓</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{entry.views}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Link
                        href={`/admin/platform/media/${entry.id}/edit`}
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
