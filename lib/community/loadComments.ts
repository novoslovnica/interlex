import { init } from "@/lib/sqlite"
import { resolvePublicNames } from "./identity"
import { fetchCommentTree, fetchRecentComments, type CommentNode, type RecentComment } from "./comments"

// Нить со вставленными никами (auth.db - вторая фаза). userId наружу не
// уходит; автора без ника (ник удалён после написания) показываем как аноним.
export interface CommentView {
    id: number
    parentId: number | null
    handle: string | null
    own: boolean // это комментарий смотрящего (userId наружу не уходит)
    body: string | null
    status: CommentNode["status"]
    createdAt: string
    editedAt: string | null
    replies: CommentView[]
}

export interface CommentThread {
    comments: CommentView[]
    total: number
}

export async function loadCommentThread(lexemeId: number, viewerUserId?: string | null): Promise<CommentThread> {
    const db = await init()
    let tree
    try {
        tree = fetchCommentTree(db, lexemeId)
    } finally {
        db.close()
    }
    const names = await resolvePublicNames(tree.flatMap((node) => [node.userId, ...node.replies.map((reply) => reply.userId)]))
    const toView = ({ userId, ...node }: CommentNode): CommentView => ({
        ...node,
        handle: userId ? (names.get(userId) ?? null) : null,
        own: Boolean(viewerUserId && userId === viewerUserId),
        replies: node.replies.map(toView),
    })
    const comments = tree.map(toView)
    const total = comments.reduce((sum, node) => sum + (node.status === "visible" ? 1 : 0) + node.replies.length, 0)
    return { comments, total }
}

export interface RecentCommentView extends Omit<RecentComment, "userId"> {
    handle: string | null
}

export async function loadRecentComments(limit = 10): Promise<RecentCommentView[]> {
    const db = await init()
    let rows
    try {
        rows = fetchRecentComments(db, limit)
    } finally {
        db.close()
    }
    const names = await resolvePublicNames(rows.map((row) => row.userId))
    return rows.map(({ userId, ...row }) => ({ ...row, handle: names.get(userId) ?? null }))
}
