import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.RootsCreate)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { value, type, actionHistory, allophones } = body

    if (!value || !value.trim()) {
      return NextResponse.json({ error: "value is required" }, { status: 400 })
    }

    const root = await db.morpheme.create({
      data: {
        value,
        type: type !== undefined ? type : 0,
        actionHistory: actionHistory || null,
      },
    })

    if (allophones) {
      for (const code of ["CORE", "NSL", "EAST", "WEST", "SOUTH"] as const) {
        const key = code.toLowerCase()
        const rawValue = allophones[key]
        const strValue = (rawValue as string)?.trim()
        if (!strValue) continue
        const flavor = await db.allophoneFlavor.findUnique({ where: { code } })
        if (!flavor) continue
        await db.morphemeAllophone.create({
          data: { morphemeId: root.id, flavorId: flavor.id, value: strValue },
        })
      }
    }

    return NextResponse.json(root, { status: 201 })
  } catch (error) {
    console.error("API Root CREATE Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}