import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prismaLibrary as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import { MediaLibraryForm } from "../../form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Редактирование записи — медиатека",
  description: "Редактирование записи медиатеки сообщества.",
}

export default async function EditMediaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.MediaLibraryManage)

  const { id } = await params
  const entryId = parseInt(id, 10)
  const entry = await db.mediaLibraryEntry.findUnique({ where: { id: entryId } })
  if (!entry) notFound()

  async function save(formData: FormData) {
    "use server"
    const s = await auth()
    if (!s) throw new Error("Unauthorized")
    await requirePermission(s, Feature.MediaLibraryManage)

    const title = formData.get("title") as string
    const slug = formData.get("slug") as string
    const mediaType = formData.get("mediaType") as string
    const url = formData.get("url") as string
    const platform = (formData.get("platform") as string) || null
    const description = (formData.get("description") as string) || null
    const thumbnailUrl = (formData.get("thumbnailUrl") as string) || null
    const language = (formData.get("language") as string) || null
    const verified = formData.get("verified") === "on"
    const isPublic = formData.get("isPublic") === "on"
    const userEmail = s.user.email || "unknown"

    await db.mediaLibraryEntry.update({
      where: { id: entryId },
      data: {
        title,
        slug,
        mediaType,
        url,
        platform,
        description,
        thumbnailUrl,
        language,
        verified,
        verifiedBy: verified ? userEmail : null,
        isPublic,
      },
    })

    redirect("/admin/platform/media")
  }

  return (
      <div className="flex-1 min-h-0 overflow-auto p-6 w-full">
        <h1 className="text-xl font-bold mb-6">Редактирование: {entry.title}</h1>
        <MediaLibraryForm
          action={save}
          initial={{
            slug: entry.slug,
            title: entry.title,
            mediaType: entry.mediaType,
            url: entry.url,
            platform: entry.platform || "",
            description: entry.description || "",
            thumbnailUrl: entry.thumbnailUrl || "",
            language: entry.language || "",
            verified: entry.verified,
            isPublic: entry.isPublic,
          }}
        />
      </div>
  )
}
