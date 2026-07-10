import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.EndingsEdit)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const rowId = parseInt(id)
    if (isNaN(rowId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await request.json()
    const { value } = body

    if (value === undefined) {
      return NextResponse.json({ error: "value is required" }, { status: 400 })
    }

    const updated = await db.endingAllophone.update({
      where: { id: rowId },
      data: { value },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("API Endings PATCH Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.EndingsDelete)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const rowId = parseInt(id)
    if (isNaN(rowId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    await db.endingAllophone.delete({ where: { id: rowId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API Endings DELETE Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}