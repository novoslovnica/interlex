import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { logAudit, type FieldChange } from "@/lib/audit-log"

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
        protoSlavicWord: true,
        protoSuggestion: { select: { id: true, lemma: true } },
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
    const { value, type, allophones, stressPosition, meaning, protoSlavicWordId, protoSuggestionAction } = body

    const before = await db.morpheme.findUnique({ where: { id: rootId } })

    // Once a moderator sets a real protoSlavicWordId (via the cached
    // suggestion's Accept button or the manual search picker) a pending
    // suggestion is resolved either way — drop it out of the
    // /admin/roots?protoPending=true review queue.
    const resolvesProtoSuggestion =
      protoSlavicWordId !== undefined && protoSlavicWordId !== null && before?.protoSuggestionStatus === "pending"
    const protoSuggestionStatusUpdate =
      protoSuggestionAction === "dismiss"
        ? "dismissed"
        : protoSuggestionAction === "apply" || resolvesProtoSuggestion
          ? "applied"
          : undefined

    const root = await db.morpheme.update({
      where: { id: rootId },
      data: {
        ...(value !== undefined && { value }),
        ...(type !== undefined && { type }),
        ...(stressPosition !== undefined && { stressPosition: stressPosition ?? null }),
        ...(meaning !== undefined && { meaning: meaning ?? null }),
        ...(protoSlavicWordId !== undefined && { protoSlavicWordId: protoSlavicWordId ?? null }),
        ...(protoSuggestionStatusUpdate && {
          protoSuggestionStatus: protoSuggestionStatusUpdate,
          protoSuggestionReviewedByUserId: session?.user?.id ?? null,
          protoSuggestionReviewedAt: new Date(),
        }),
      },
    })

    const changes: FieldChange[] = []
    if (value !== undefined && before?.value !== value) {
      changes.push({ field: "value", oldValue: before?.value ?? null, newValue: value })
    }
    if (type !== undefined && before?.type !== type) {
      changes.push({ field: "type", oldValue: before?.type ?? null, newValue: type })
    }
    if (stressPosition !== undefined && before?.stressPosition !== (stressPosition ?? null)) {
      changes.push({ field: "stressPosition", oldValue: before?.stressPosition ?? null, newValue: stressPosition ?? null })
    }
    if (meaning !== undefined && (before?.meaning ?? null) !== (meaning ?? null)) {
      changes.push({ field: "meaning", oldValue: before?.meaning ?? null, newValue: meaning ?? null })
    }
    if (protoSlavicWordId !== undefined && (before?.protoSlavicWordId ?? null) !== (protoSlavicWordId ?? null)) {
      changes.push({ field: "protoSlavicWordId", oldValue: before?.protoSlavicWordId ?? null, newValue: protoSlavicWordId ?? null })
    }
    await logAudit(session?.user, "Morpheme", rootId, changes)

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