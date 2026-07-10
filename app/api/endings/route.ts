import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.EndingsEdit)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const stemType = searchParams.get("stemType")

    const where: Record<string, unknown> = {}
    if (stemType) where.stemType = stemType

    const items = await db.endingAllophone.findMany({
      where,
      include: { flavor: true },
      orderBy: [{ stemType: "asc" }, { grammeme: "asc" }, { flavor: { code: "asc" } }],
    })

    const total = await db.endingAllophone.count({ where })

    return NextResponse.json({ items, total })
  } catch (error) {
    console.error("API Endings GET Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.EndingsCreate)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { stemType, grammeme, flavorCode, value } = body

    if (!stemType || !grammeme || !flavorCode) {
      return NextResponse.json({ error: "stemType, grammeme and flavorCode are required" }, { status: 400 })
    }

    if (!value?.trim()) {
      return NextResponse.json({ error: "value is required" }, { status: 400 })
    }

    const flavor = await db.allophoneFlavor.findUnique({ where: { code: flavorCode } })
    if (!flavor) {
      return NextResponse.json({ error: `Flavor ${flavorCode} not found` }, { status: 500 })
    }

    const row = await db.endingAllophone.upsert({
      where: { stemType_grammeme_flavorId: { stemType, grammeme, flavorId: flavor.id } },
      update: { value: value.trim() },
      create: { stemType, grammeme, value: value.trim(), flavorId: flavor.id },
    })

    return NextResponse.json([row], { status: 201 })
  } catch (error) {
    console.error("API Endings POST Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}