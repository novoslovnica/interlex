import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaAuth } from "@/lib/prisma"
import { init } from "@/lib/sqlite"
import { createComment, checkCommentAllowance, COMMENT_MAX_LENGTH, type CreateCommentError } from "@/lib/community/comments"
import { loadCommentThread } from "@/lib/community/loadComments"

const CREATE_STATUS: Record<CreateCommentError, number> = { lexeme_not_found: 404, parent_not_found: 404, too_deep: 400, empty: 400, too_long: 400 }

function parseId(id: string): number | null {
    const value = Number(id)
    return Number.isInteger(value) && value > 0 ? value : null
}

// Чтение - публичное (то же, что показывает страница слова).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const lexemeId = parseId((await params).id)
    if (!lexemeId) return NextResponse.json({ error: "Bad id" }, { status: 400 })
    const session = await auth()
    return NextResponse.json(await loadCommentThread(lexemeId, session?.user?.id))
}

// Запись - сессия + публичный ник (анонимная нить бессмысленна; ник -
// UserProfile, см. фазу 0). Feature не нужен: самообслуживание участника.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const lexemeId = parseId((await params).id)
    if (!lexemeId) return NextResponse.json({ error: "Bad id" }, { status: 400 })
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const profile = await prismaAuth.userProfile.findUnique({ where: { userId }, select: { handle: true } })
    if (!profile) return NextResponse.json({ error: "handle_required" }, { status: 403 })

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const text = typeof body.body === "string" ? body.body : ""
    const parentId = body.parentId == null ? null : Number(body.parentId)
    if (text.length > COMMENT_MAX_LENGTH) return NextResponse.json({ error: "too_long" }, { status: 400 })
    if (parentId !== null && !(Number.isInteger(parentId) && parentId > 0)) return NextResponse.json({ error: "Bad parentId" }, { status: 400 })

    const db = await init()
    try {
        const allowance = checkCommentAllowance(db, userId)
        if (!allowance.allowed) {
            return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(allowance.retryAfterMinutes * 60) } })
        }
        const result = createComment(db, { lexemeId, userId, body: text, parentId })
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: CREATE_STATUS[result.error] })
        return NextResponse.json({ ok: true, comment: { ...result.comment, handle: profile.handle } })
    } finally {
        db.close()
    }
}
