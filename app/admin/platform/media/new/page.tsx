import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaLibrary as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import { MediaLibraryForm } from "../form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Новая запись — медиатека",
  description: "Добавление подкаста/YouTube-канала/видео в медиатеку сообщества.",
}

export default async function NewMediaPage() {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.MediaLibraryManage)

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
    const userId = s.user.id

    await db.mediaLibraryEntry.create({
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
        addedById: userId,
        addedBy: userEmail,
      },
    })

    redirect("/admin/platform/media")
  }

  return (
      <div className="flex-1 min-h-0 overflow-auto p-6 w-full">
        <h1 className="text-xl font-bold mb-6">Новая запись медиатеки</h1>
        <MediaLibraryForm action={save} />
      </div>
  )
}
