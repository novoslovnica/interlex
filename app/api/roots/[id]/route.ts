import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.RootsEdit)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const rootId = parseInt(id)
    if (isNaN(rootId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const root = await db.morpheme.findUnique({
      where: { id: rootId },
      include: {
        lexemes_morphemes: {
          include: {
            lexeme: {
              select: { id: true, value: true },
            },
          },
        },
        morphemeAllophones: {
          include: { flavor: true },
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
    if (!await checkPermission(session, Feature.RootsEdit)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const rootId = parseInt(id)
    if (isNaN(rootId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await request.json()
    const { value, type, actionHistory, allophones } = body

    const root = await db.morpheme.update({
      where: { id: rootId },
      data: {
        ...(value !== undefined && { value }),
        ...(type !== undefined && { type }),
        ...(actionHistory !== undefined && { actionHistory }),
      },
    })

    if (allophones) {
      for (const code of ["CORE", "NSL", "EAST", "WEST", "SOUTH"] as const) {
        const key = code.toLowerCase()
        const rawValue = allophones[key]
        const strValue = (rawValue as string)?.trim() || ""
        const flavor = await db.allophoneFlavor.findUnique({ where: { code } })
        if (!flavor) continue
        const existing = await db.morphemeAllophone.findUnique({
          where: { morphemeId_flavorId: { morphemeId: rootId, flavorId: flavor.id } },
        })
        if (existing) {
          if (strValue) {
            await db.morphemeAllophone.update({
              where: { id: existing.id },
              data: { value: strValue },
            })
          } else {
            await db.morphemeAllophone.delete({ where: { id: existing.id } })
          }
        } else if (strValue) {
          await db.morphemeAllophone.create({
            data: { morphemeId: rootId, flavorId: flavor.id, value: strValue },
          })
        }
      }
    }

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
    if (!await checkPermission(session, Feature.RootsDelete)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const rootId = parseInt(id)
    if (isNaN(rootId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    await db.morpheme.delete({ where: { id: rootId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API Root DELETE Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}