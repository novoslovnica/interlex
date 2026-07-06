import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !["ADMIN", "MODERATOR"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const rootId = parseInt(id)
    if (isNaN(rootId)) {
      return NextResponse.json({ error: "Invalid root id" }, { status: 400 })
    }

    const { wordId } = await request.json()
    if (!wordId || typeof wordId !== "number") {
      return NextResponse.json({ error: "wordId is required" }, { status: 400 })
    }

    const existing = await db.rootWord.findFirst({
      where: { rootId, wordId },
    })
    if (existing) {
      return NextResponse.json({ error: "Word already linked" }, { status: 409 })
    }

    const rw = await db.rootWord.create({
      data: { rootId, wordId },
    })

    return NextResponse.json(rw, { status: 201 })
  } catch (error) {
    console.error("API Root Add Word Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !["ADMIN", "MODERATOR"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const rootId = parseInt(id)
    if (isNaN(rootId)) {
      return NextResponse.json({ error: "Invalid root id" }, { status: 400 })
    }

    const { rootWordId } = await request.json()
    if (!rootWordId || typeof rootWordId !== "number") {
      return NextResponse.json({ error: "rootWordId is required" }, { status: 400 })
    }

    await db.rootWord.delete({
      where: { id: rootWordId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API Root Remove Word Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}