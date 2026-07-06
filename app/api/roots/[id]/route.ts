import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"

export async function GET(
  _request: Request,
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
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const root = await db.root.findUnique({
      where: { id: rootId },
      include: {
        roots_words: {
          include: {
            word: {
              select: { id: true, value: true, isv: true },
            },
          },
        },
      },
    })

    if (!root) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(root)
  } catch (error) {
    console.error("API Root GET Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(
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
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await request.json()
    const { value, type, actionHistory } = body

    const root = await db.root.update({
      where: { id: rootId },
      data: {
        ...(value !== undefined && { value }),
        ...(type !== undefined && { type }),
        ...(actionHistory !== undefined && { actionHistory }),
      },
    })

    return NextResponse.json(root)
  } catch (error) {
    console.error("API Root PATCH Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
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
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    await db.root.delete({ where: { id: rootId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API Root DELETE Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}