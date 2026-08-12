import { NextResponse } from "next/server"
import { prismaCorpus as db } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { resetVerbGovernmentCache } from "@/lib/corpus/syntax/government"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.VerbGovernmentEdit)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const verbLemma = searchParams.get("verbLemma")

    const where: Record<string, unknown> = {}
    if (verbLemma) where.verbLemma = { contains: verbLemma }

    const items = await db.verbGovernment.findMany({
      where,
      orderBy: [{ verbLemma: "asc" }, { reflexive: "asc" }, { priority: "asc" }],
    })

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error("API VerbGovernment GET Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.VerbGovernmentEdit)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { verbLemma, reflexive, requiredCase, role, priority, note } = body

    if (!verbLemma?.trim()) {
      return NextResponse.json({ error: "verbLemma is required" }, { status: 400 })
    }
    if (!requiredCase?.trim()) {
      return NextResponse.json({ error: "requiredCase is required" }, { status: 400 })
    }

    const row = await db.verbGovernment.upsert({
      where: {
        verbLemma_requiredCase_reflexive: {
          verbLemma: verbLemma.trim(),
          requiredCase: requiredCase.trim(),
          reflexive: !!reflexive,
        },
      },
      update: {
        role: role || "obj",
        priority: priority ?? 0,
        note: note?.trim() || null,
      },
      create: {
        verbLemma: verbLemma.trim(),
        reflexive: !!reflexive,
        requiredCase: requiredCase.trim(),
        role: role || "obj",
        priority: priority ?? 0,
        note: note?.trim() || null,
      },
    })

    resetVerbGovernmentCache()

    return NextResponse.json([row], { status: 201 })
  } catch (error) {
    console.error("API VerbGovernment POST Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
