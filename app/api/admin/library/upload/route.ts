import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

function resolveDir(envVar: string | undefined, fallback: string): string {
  const dir = envVar || fallback
  return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir)
}

function getCoversDir(): string {
  return resolveDir(process.env.COVERS_DIR, "public/covers")
}

function getAudioDir(): string {
  return resolveDir(process.env.AUDIO_DIR, "public/audio")
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await requirePermission(session, Feature.LibraryManage)

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const slug = formData.get("slug") as string
  const type = formData.get("type") as string

  if (!file || !slug || !type) {
    return NextResponse.json({ error: "Missing file, slug, or type" }, { status: 400 })
  }

  const ext = file.name.split(".").pop() || (type === "cover" ? "jpg" : "mp3")
  const filename = `${slug}-${Date.now()}.${ext}`

  if (type === "cover") {
    const dir = getCoversDir()
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))
    return NextResponse.json({ path: `/api/covers/${filename}` })
  }

  const dir = getAudioDir()
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))
  return NextResponse.json({ path: `/api/audio/${filename}` })
}