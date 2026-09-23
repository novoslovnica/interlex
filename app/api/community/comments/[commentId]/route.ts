import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { init } from "@/lib/sqlite"
import { editOwnComment, deleteOwnComment, COMMENT_MAX_LENGTH, type OwnCommentError } from "@/lib/community/comments"

const STATUS: Record<OwnCommentError, number> = { not_found: 404, not_owner: 403, empty: 400, too_long: 400 }

async function context(params: Promise<{ commentId: string }>) {
    const commentId = Number((await params).commentId)
    const session = await auth()
    return { commentId: Number.isInteger(commentId) && commentId > 0 ? commentId : null, userId: session?.user?.id ?? null }
}

// Правка и удаление своего комментария. Модераторское скрытие - не здесь, а
// в очереди жалоб (app/admin/reports/actions.ts, Feature.CommentsModerate).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
    const { commentId, userId } = await context(params)
    if (!commentId) return NextResponse.json({ error: "Bad id" }, { status: 400 })
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const text = typeof body.body === "string" ? body.body : ""
    if (text.length > COMMENT_MAX_LENGTH) return NextResponse.json({ error: "too_long" }, { status: 400 })
    const db = await init()
    try {
        const result = editOwnComment(db, { commentId, userId, body: text })
        return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: STATUS[result.error] })
    } finally {
        db.close()
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
    const { commentId, userId } = await context(params)
    if (!commentId) return NextResponse.json({ error: "Bad id" }, { status: 400 })
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const db = await init()
    try {
        const result = deleteOwnComment(db, { commentId, userId })
        return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: STATUS[result.error] })
    } finally {
        db.close()
    }
}
