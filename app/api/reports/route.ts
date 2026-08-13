import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"

// Public, unauthenticated endpoint behind the "report an error" button on
// /words/[id] (roadmap item 97) - anonymous submissions are allowed by
// design (see AGENTS.md), rate-limited more tightly than the general API
// surface in proxy.ts (PUBLIC_WRITE_PATHS). Session is only used to attach
// submitterUserId automatically when the visitor happens to be logged in;
// it is never required.
const ENTITY_TYPES = new Set(["Meaning", "Translation", "Lexeme"])
const REASON_CODES = new Set(["wrong_translation", "wrong_meaning", "typo", "grammar", "other"])
const MAX_COMMENT_LENGTH = 2000
const MAX_CONTACT_LENGTH = 200

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { entityType, entityId, lexemeId, field, reportedValue, reasonCode, comment, submitterContact } = body

    if (!ENTITY_TYPES.has(entityType)) {
      return NextResponse.json({ error: "Invalid entityType" }, { status: 400 })
    }
    if (!REASON_CODES.has(reasonCode)) {
      return NextResponse.json({ error: "Invalid reasonCode" }, { status: 400 })
    }
    const parsedEntityId = Number(entityId)
    const parsedLexemeId = Number(lexemeId)
    if (!Number.isInteger(parsedEntityId) || !Number.isInteger(parsedLexemeId)) {
      return NextResponse.json({ error: "entityId and lexemeId must be integers" }, { status: 400 })
    }
    if (typeof comment === "string" && comment.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json({ error: "Comment too long" }, { status: 400 })
    }
    if (typeof submitterContact === "string" && submitterContact.length > MAX_CONTACT_LENGTH) {
      return NextResponse.json({ error: "Contact too long" }, { status: 400 })
    }

    const lexeme = await db.lexeme.findUnique({ where: { id: parsedLexemeId }, select: { id: true } })
    if (!lexeme) {
      return NextResponse.json({ error: "Lexeme not found" }, { status: 404 })
    }

    const session = await auth()

    const report = await db.contentReport.create({
      data: {
        entityType,
        entityId: parsedEntityId,
        lexemeId: parsedLexemeId,
        field: typeof field === "string" ? field.slice(0, 100) : null,
        reportedValue: typeof reportedValue === "string" ? reportedValue.slice(0, 500) : null,
        reasonCode,
        comment: typeof comment === "string" ? comment : null,
        submitterUserId: session?.user?.id ?? null,
        submitterContact: session?.user ? null : (typeof submitterContact === "string" ? submitterContact : null),
      },
    })

    return NextResponse.json({ id: report.id }, { status: 201 })
  } catch (error) {
    console.error("API ContentReport CREATE Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
