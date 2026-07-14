import { NextRequest, NextResponse } from "next/server"
import { prismaLibrary as db } from "@/lib/prisma"
import { decompressBody, splitIntoChapters } from "@/lib/body"
import { marked } from "marked"
import { tmpdir } from "os"
import { join } from "path"
import { readFileSync, unlinkSync, rmSync } from "fs"
import { randomUUID } from "crypto"

interface PageParams {
  params: Promise<{ slug: string }>
}

export async function GET(_request: NextRequest, { params }: PageParams) {
  const { slug } = await params

  const entry = await db.libraryEntry.findUnique({ where: { slug } })
  if (!entry || !entry.body) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = decompressBody(entry.body)
  const chapters = splitIntoChapters(body)

  const content = await Promise.all(
    chapters.map(async ch => ({
      title: ch.heading || entry.title,
      data: await marked.parse(ch.content),
    }))
  )

  const tempDir = join(tmpdir(), randomUUID())
  const outputPath = join(tempDir, `${slug}.epub`)

  const EPub = (await import("epub-gen")).default

  const epub = new EPub(
    {
      title: entry.title,
      author: entry.author || "Neznany autor",
      publisher: "Interslavic Lexicon",
      lang: "isv",
      output: outputPath,
      tempDir,
      content,
    },
    outputPath,
  )

  await epub.promise

  const epubBuffer = readFileSync(outputPath)
  unlinkSync(outputPath)
  rmSync(tempDir, { recursive: true, force: true })

  return new NextResponse(epubBuffer, {
    headers: {
      "Content-Type": "application/epub+zip",
      "Content-Disposition": `attachment; filename="${slug}.epub"`,
    },
  })
}