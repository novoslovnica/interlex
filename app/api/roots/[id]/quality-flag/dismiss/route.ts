import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"

// Dismisses a quality-flag suggestion raised by scripts/roots-discovery/
// {fix-known-root-bugs,audit-root-quality}.ts (see /admin/roots?flagged=true)
// without applying its suggested fix — the moderator looked at it and
// decided the root is fine as-is. qualityFlagStatus='dismissed' means the
// audit script will never re-flag this row (see audit-root-quality.ts's
// qualityFlagStatus IS NULL guard).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!(await checkPermission(session, Feature.RootsEdit))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const rootId = parseInt(id)
    if (isNaN(rootId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const root = await db.morpheme.update({
      where: { id: rootId },
      data: {
        qualityFlagStatus: "dismissed",
        qualityFlagReviewedByUserId: session?.user?.id ?? null,
        qualityFlagReviewedAt: new Date(),
      },
    })

    return NextResponse.json(root)
  } catch (error) {
    console.error("API Root Quality-Flag Dismiss Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
