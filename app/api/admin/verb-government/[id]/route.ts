import { NextResponse } from "next/server"
import { prismaCorpus as db } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { resetVerbGovernmentCache } from "@/lib/corpus/syntax/government"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.VerbGovernmentEdit)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const rowId = parseInt(id)
    if (isNaN(rowId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await request.json()
    const { role, priority, note } = body

    const updated = await db.verbGovernment.update({
      where: { id: rowId },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(note !== undefined ? { note: note?.trim() || null } : {}),
      },
    })

    resetVerbGovernmentCache()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("API VerbGovernment PATCH Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.VerbGovernmentEdit)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const rowId = parseInt(id)
    if (isNaN(rowId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    await db.verbGovernment.delete({ where: { id: rowId } })

    resetVerbGovernmentCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API VerbGovernment DELETE Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
