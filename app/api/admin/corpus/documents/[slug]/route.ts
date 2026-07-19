import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaCorpus } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusBuilder))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { slug } = await params
  const { title, author } = await request.json()

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }

  try {
    const doc = await prismaCorpus.corpusDocument.findUnique({ where: { slug } })
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const updated = await prismaCorpus.corpusDocument.update({
      where: { slug },
      data: {
        title: title.trim(),
        author: typeof author === "string" ? author.trim() || null : null,
      },
      select: { id: true, title: true, slug: true, author: true },
    })

    return NextResponse.json({ ok: true, document: updated })
  } catch (error) {
    console.error("Failed to update document:", error)
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
  }
}