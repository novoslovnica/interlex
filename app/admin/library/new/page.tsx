import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaLibrary as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import AdminNav from "@/components/AdminNav"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { buildEntry, append } from "@/lib/action-history"
import { compressBody } from "@/lib/body"
import { LibraryForm } from "./form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Новый текст — библиотека",
  description: "Добавление нового текста в библиотеку межславянского языка.",
}

export default async function NewLibraryPage() {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.LibraryManage)

  const userPermissions = session.user.role === "MODERATOR"
    ? (await dbAuth.featurePermission.findMany({
        where: { userId: session.user.id },
        select: { featureKey: true },
      })).map(p => p.featureKey)
    : []

  async function save(formData: FormData) {
    "use server"
    const s = await auth()
    if (!s) throw new Error("Unauthorized")
    await requirePermission(s, Feature.LibraryManage)

    const title = formData.get("title") as string
    const slug = formData.get("slug") as string
    const author = (formData.get("author") as string) || null
    const genre = formData.get("genre") as string
    const topic = (formData.get("topic") as string) || null
    const flavor = (formData.get("flavor") as string) || "CORE"
    const source = (formData.get("source") as string) || null
    const yearRaw = formData.get("yearWritten") as string
    const yearWritten = yearRaw ? parseInt(yearRaw, 10) : null
    const yearTransRaw = formData.get("yearTranslated") as string
    const yearTranslated = yearTransRaw ? parseInt(yearTransRaw, 10) : null
    const translator = (formData.get("translator") as string) || null
    const coverImageRaw = formData.get("coverImage")
    let coverImage: string | null = null
    if (typeof coverImageRaw === "string" && coverImageRaw.length > 0) {
      coverImage = coverImageRaw
    }
    const audioFileRaw = formData.get("audioFile")
    let audioFile: string | null = null
    if (typeof audioFileRaw === "string" && audioFileRaw.length > 0) {
      audioFile = audioFileRaw
    }
    const body = (formData.get("body") as string) || null
    const summary = (formData.get("summary") as string) || null
    const corpusSlug = (formData.get("corpusSlug") as string) || null
    const verified = formData.get("verified") === "on"
    const isPublic = formData.get("isPublic") === "on"
    const parentIdRaw = formData.get("parentId") as string
    const parentId = parentIdRaw ? parseInt(parentIdRaw, 10) : null
    const childIdsRaw = formData.getAll("childIds") as string[]
    const childIds = childIdsRaw.map(Number).filter(Boolean)
    const userEmail = s.user.email || "unknown"
    const userId = s.user.id

    const actionHistory = append(null, buildEntry(userEmail, {
      title: { old: null, new: title },
      slug: { old: null, new: slug },
      author: { old: null, new: author },
      genre: { old: null, new: genre },
      topic: { old: null, new: topic },
      flavor: { old: null, new: flavor },
      source: { old: null, new: source },
      yearWritten: { old: null, new: yearWritten },
      yearTranslated: { old: null, new: yearTranslated },
      translator: { old: null, new: translator },
      coverImage: { old: null, new: coverImage },
      audioFile: { old: null, new: audioFile },
      verified: { old: null, new: verified },
      isPublic: { old: null, new: isPublic },
      parentId: { old: null, new: parentId },
    }))

    const created = await db.libraryEntry.create({
      data: {
        slug,
        title,
        author,
        genre,
        topic,
        flavor,
        source,
        yearWritten,
        yearTranslated,
        translator,
        audioFile,
        body: body ? compressBody(body) : null,
        bodyLength: body ? body.length : 0,
        summary,
        corpusSlug,
        verified,
        isPublic,
        parentId,
        verifiedBy: verified ? userEmail : null,
        addedById: userId,
        addedBy: userEmail,
        actionHistory,
      },
    })

    if (childIds.length > 0) {
      await db.$transaction(
        childIds.map(id => db.libraryEntry.update({ where: { id }, data: { parentId: created.id } }))
      )
    }

    redirect("/admin/library")
  }

  const allEntries = await db.libraryEntry.findMany({
    select: { id: true, title: true, slug: true },
    orderBy: { title: "asc" },
  })

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
      <div className="flex-1 min-h-0 overflow-auto p-6 w-full">
        <h1 className="text-xl font-bold mb-6">Новый текст</h1>
        <LibraryForm action={save} entries={allEntries} />
      </div>
    </div>
  )
}