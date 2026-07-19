import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prismaLibrary as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import AdminNav from "@/components/AdminNav"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { buildEntry, append } from "@/lib/action-history"
import { compressBody, decompressBody } from "@/lib/body"
import { LibraryForm } from "../../new/form"
import type { Metadata } from "next"
import { unlink } from "fs/promises"
import path from "path"

export const metadata: Metadata = {
  title: "Редактирование текста — библиотека",
  description: "Редактирование текста в библиотеке межславянского языка.",
}

function getCoversDir(): string {
  const dir = process.env.COVERS_DIR || "public/covers"
  return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir)
}

function getAudioDir(): string {
  const dir = process.env.AUDIO_DIR || "public/audio"
  return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir)
}

function coverFilename(coverPath: string | null): string | null {
  if (!coverPath) return null
  return coverPath.replace(/^\/api\/covers\//, "").replace(/^\/covers\//, "") || null
}

function audioFilename(audioPath: string | null): string | null {
  if (!audioPath) return null
  return audioPath.replace(/^\/api\/audio\//, "").replace(/^\/audio\//, "") || null
}

async function safeUnlink(filepath: string) {
  try { await unlink(filepath) } catch { /* ignore */ }
}

export default async function EditLibraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.LibraryManage)

  const entryId = parseInt(id, 10)
  if (isNaN(entryId)) notFound()

  const entry = await db.libraryEntry.findUnique({ where: { id: entryId } })
  if (!entry) notFound()

  const currentEntry = entry
  const decompressedBody = currentEntry.body ? decompressBody(currentEntry.body) : ""

  const initialChildren = await db.libraryEntry.findMany({
    where: { parentId: entryId },
    select: { id: true, title: true, slug: true },
    orderBy: { title: "asc" },
  })

  async function getDescendantIds(parentId: number): Promise<number[]> {
    const children = await db.libraryEntry.findMany({
      where: { parentId },
      select: { id: true },
    })
    const nested = await Promise.all(children.map(c => getDescendantIds(c.id)))
    return [...children.map(c => c.id), ...nested.flat()]
  }

  const descendantIds = await getDescendantIds(entryId)

  async function getAncestorIds(childId: number): Promise<number[]> {
    const parent = await db.libraryEntry.findUnique({
      where: { id: childId },
      select: { parentId: true },
    })
    if (!parent?.parentId) return []
    return [parent.parentId, ...(await getAncestorIds(parent.parentId))]
  }

  const ancestorIds = await getAncestorIds(entryId)

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
    const deleteCoverImage = formData.get("deleteCoverImage") === "on"
    let coverImage = currentEntry.coverImage
    if (deleteCoverImage) {
      const oldFilename = coverFilename(currentEntry.coverImage)
      if (oldFilename) {
        await safeUnlink(path.join(getCoversDir(), oldFilename))
      }
      coverImage = null
    } else if (typeof coverImageRaw === "string" && coverImageRaw.length > 0) {
      coverImage = coverImageRaw
    }
    const audioFileRaw = formData.get("audioFile")
    const deleteAudioFile = formData.get("deleteAudioFile") === "on"
    let audioFile = currentEntry.audioFile
    if (deleteAudioFile) {
      const oldFilename = audioFilename(currentEntry.audioFile)
      if (oldFilename) {
        await safeUnlink(path.join(getAudioDir(), oldFilename))
      }
      audioFile = null
    } else if (typeof audioFileRaw === "string" && audioFileRaw.length > 0) {
      audioFile = audioFileRaw
    }
    const videoUrlsRaw = formData.get("videoUrls") as string
    const videoUrls = videoUrlsRaw && videoUrlsRaw !== "[]" ? videoUrlsRaw : null
    const body = (formData.get("body") as string) || null
    const decompressedBody = currentEntry.body ? decompressBody(currentEntry.body) : ""
    const summary = (formData.get("summary") as string) || null
    const corpusSlug = (formData.get("corpusSlug") as string) || null
    const verified = formData.get("verified") === "on"
    const isPublic = formData.get("isPublic") === "on"
    const parentIdRaw = formData.get("parentId") as string
    const parentId = parentIdRaw ? parseInt(parentIdRaw, 10) : null
    const childIdsRaw = formData.getAll("childIds") as string[]
    const newChildIds = childIdsRaw.map(Number).filter(Boolean)
    const userEmail = s.user.email || "unknown"

    const changes: Record<string, { old: unknown; new: unknown }> = {}
    if (title !== currentEntry.title) changes.title = { old: currentEntry.title, new: title }
    if (slug !== currentEntry.slug) changes.slug = { old: currentEntry.slug, new: slug }
    if (author !== currentEntry.author) changes.author = { old: currentEntry.author, new: author }
    if (genre !== currentEntry.genre) changes.genre = { old: currentEntry.genre, new: genre }
    if (topic !== currentEntry.topic) changes.topic = { old: currentEntry.topic, new: topic }
    if (flavor !== currentEntry.flavor) changes.flavor = { old: currentEntry.flavor, new: flavor }
    if (source !== currentEntry.source) changes.source = { old: currentEntry.source, new: source }
    if (yearWritten !== currentEntry.yearWritten) changes.yearWritten = { old: currentEntry.yearWritten, new: yearWritten }
    if (yearTranslated !== currentEntry.yearTranslated) changes.yearTranslated = { old: currentEntry.yearTranslated, new: yearTranslated }
    if (translator !== currentEntry.translator) changes.translator = { old: currentEntry.translator, new: translator }
    if (coverImage !== currentEntry.coverImage) changes.coverImage = { old: currentEntry.coverImage, new: coverImage }
    if (audioFile !== currentEntry.audioFile) changes.audioFile = { old: currentEntry.audioFile, new: audioFile }
    if (videoUrls !== currentEntry.videoUrls) changes.videoUrls = { old: currentEntry.videoUrls, new: videoUrls }
    if (body !== decompressedBody) changes.body = { old: decompressedBody, new: body }
    if (summary !== currentEntry.summary) changes.summary = { old: currentEntry.summary, new: summary }
    if (corpusSlug !== currentEntry.corpusSlug) changes.corpusSlug = { old: currentEntry.corpusSlug, new: corpusSlug }
    if (verified !== currentEntry.verified) changes.verified = { old: currentEntry.verified, new: verified }
    if (isPublic !== currentEntry.isPublic) changes.isPublic = { old: currentEntry.isPublic, new: isPublic }
    if (parentId !== currentEntry.parentId) changes.parentId = { old: currentEntry.parentId, new: parentId }

    await db.libraryEntry.update({
      where: { id: entryId },
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
        coverImage,
        audioFile,
        videoUrls,
        body: body ? compressBody(body) : null,
        bodyLength: body ? body.length : 0,
        summary,
        corpusSlug,
        verified,
        isPublic,
        parentId,
        verifiedBy: verified ? userEmail : null,
        actionHistory: append(currentEntry.actionHistory, buildEntry(userEmail, changes)),
      },
    })

    const initialChildIds = initialChildren.map(c => c.id)
    const addedIds = newChildIds.filter(id => !initialChildIds.includes(id))
    const removedIds = initialChildIds.filter(id => !newChildIds.includes(id))

    await db.$transaction([
      ...addedIds.map(id => db.libraryEntry.update({ where: { id }, data: { parentId: entryId } })),
      ...removedIds.map(id => db.libraryEntry.update({ where: { id }, data: { parentId: null } })),
    ])

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
        <h1 className="text-xl font-bold mb-6">Редактирование: {currentEntry.title}</h1>
        <LibraryForm
          action={save}
          entries={allEntries}
          excludeIds={[entryId, ...descendantIds]}
          excludeFromChildSearch={[entryId, ...ancestorIds]}
          initialChildren={initialChildren}
          initial={{
            slug: currentEntry.slug,
            title: currentEntry.title,
            author: currentEntry.author || "",
            genre: currentEntry.genre,
            topic: currentEntry.topic || "",
            flavor: currentEntry.flavor,
            body: decompressedBody,
            summary: currentEntry.summary || "",
            corpusSlug: currentEntry.corpusSlug || "",
            coverImage: currentEntry.coverImage || "",
            audioFile: currentEntry.audioFile || "",
            videoUrls: currentEntry.videoUrls || "",
            verified: currentEntry.verified,
            source: currentEntry.source || "",
            yearWritten: currentEntry.yearWritten,
            yearTranslated: currentEntry.yearTranslated,
            translator: currentEntry.translator || "",
            isPublic: currentEntry.isPublic,
            parentId: currentEntry.parentId,
          }}
        />
      </div>
    </div>
  )
}