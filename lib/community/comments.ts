import type Database from "better-sqlite3"

// Обсуждение у слова (фаза 5): одна нить на лексему, один уровень
// вложенности (ответ на ответ невозможен). Постмодерация: комментарий
// виден сразу; жалоба - через ContentReport (entityType 'Comment'),
// скрытие - модератор с Feature.CommentsModerate. Писать может только
// участник с публичным ником - проверяет роут, здесь только данные.

export { COMMENT_MAX_LENGTH } from "./constants"
import { COMMENT_MAX_LENGTH } from "./constants"
export const COMMENTS_PER_WORD_LIMIT = 300

export type CommentStatus = "visible" | "hidden" | "deleted"

export interface CommentRow {
    id: number
    lexemeId: number
    parentId: number | null
    userId: string
    body: string
    status: CommentStatus
    createdAt: string
    editedAt: string | null
}

// Что уходит наружу: у скрытого/удалённого тела нет, автора нет - строка
// остаётся только как место, на которое висят ответы.
export interface CommentNode {
    id: number
    parentId: number | null
    userId: string | null
    body: string | null
    status: CommentStatus
    createdAt: string
    editedAt: string | null
    replies: CommentNode[]
}

export function fetchCommentTree(db: Database.Database, lexemeId: number): CommentNode[] {
    const rows = db.prepare(`
        SELECT id, lexemeId, parentId, userId, body, status, createdAt, editedAt FROM word_comments
        WHERE lexemeId = ? ORDER BY createdAt ASC, id ASC LIMIT ${COMMENTS_PER_WORD_LIMIT}
    `).all(lexemeId) as CommentRow[]
    const toNode = (row: CommentRow): CommentNode => ({
        id: row.id, parentId: row.parentId, createdAt: row.createdAt, editedAt: row.editedAt, status: row.status, replies: [],
        userId: row.status === "visible" ? row.userId : null,
        body: row.status === "visible" ? row.body : null,
    })
    const roots = new Map<number, CommentNode>()
    for (const row of rows) if (row.parentId === null) roots.set(row.id, toNode(row))
    for (const row of rows) {
        if (row.parentId === null) continue
        const parent = roots.get(row.parentId)
        if (parent && row.status === "visible") parent.replies.push(toNode(row))
    }
    // Невидимый корень без видимых ответов показывать незачем.
    return [...roots.values()].filter((node) => node.status === "visible" || node.replies.length > 0)
}

export function countVisibleComments(db: Database.Database, lexemeId: number): number {
    return (db.prepare(`SELECT COUNT(*) c FROM word_comments WHERE lexemeId = ? AND status = 'visible'`).get(lexemeId) as { c: number }).c
}

// Лимиты по участнику: 5 за 10 минут; тому, у кого нет ни одного ответа на
// карточках, - 2 в час (спам-аккаунт без вклада не разгонится).
export const COMMENT_LIMIT = { count: 5, windowMinutes: 10 }
export const NEWCOMER_COMMENT_LIMIT = { count: 2, windowMinutes: 60 }

export function checkCommentAllowance(db: Database.Database, userId: string): { allowed: boolean; retryAfterMinutes: number } {
    const hasContribution = db.prepare(`SELECT 1 FROM contributor_stats WHERE userId = ? AND votesTotal > 0 LIMIT 1`).get(userId) !== undefined
    const limit = hasContribution ? COMMENT_LIMIT : NEWCOMER_COMMENT_LIMIT
    const row = db.prepare(`
        SELECT COUNT(*) AS c FROM word_comments WHERE userId = ? AND createdAt >= datetime('now', ?)
    `).get(userId, `-${limit.windowMinutes} minutes`) as { c: number }
    return { allowed: row.c < limit.count, retryAfterMinutes: limit.windowMinutes }
}

export type CreateCommentError = "lexeme_not_found" | "parent_not_found" | "too_deep" | "empty" | "too_long"

export function createComment(
    db: Database.Database,
    params: { lexemeId: number; userId: string; body: string; parentId?: number | null }
): { ok: true; comment: CommentRow } | { ok: false; error: CreateCommentError } {
    const body = params.body.trim()
    if (body === "") return { ok: false, error: "empty" }
    if (body.length > COMMENT_MAX_LENGTH) return { ok: false, error: "too_long" }
    if (!db.prepare(`SELECT 1 FROM lexemes WHERE id = ? AND isPublic = 1`).get(params.lexemeId)) return { ok: false, error: "lexeme_not_found" }
    if (params.parentId != null) {
        const parent = db.prepare(`SELECT parentId, status FROM word_comments WHERE id = ? AND lexemeId = ?`).get(params.parentId, params.lexemeId) as { parentId: number | null; status: string } | undefined
        if (!parent || parent.status !== "visible") return { ok: false, error: "parent_not_found" }
        if (parent.parentId !== null) return { ok: false, error: "too_deep" }
    }
    const info = db.prepare(`INSERT INTO word_comments (lexemeId, parentId, userId, body) VALUES (?, ?, ?, ?)`)
        .run(params.lexemeId, params.parentId ?? null, params.userId, body)
    return { ok: true, comment: db.prepare(`SELECT id, lexemeId, parentId, userId, body, status, createdAt, editedAt FROM word_comments WHERE id = ?`).get(info.lastInsertRowid) as CommentRow }
}

export type OwnCommentError = "not_found" | "not_owner" | "empty" | "too_long"

// Правка и удаление - только своего и только видимого.
export function editOwnComment(db: Database.Database, params: { commentId: number; userId: string; body: string }): { ok: true } | { ok: false; error: OwnCommentError } {
    const body = params.body.trim()
    if (body === "") return { ok: false, error: "empty" }
    if (body.length > COMMENT_MAX_LENGTH) return { ok: false, error: "too_long" }
    const row = db.prepare(`SELECT userId FROM word_comments WHERE id = ? AND status = 'visible'`).get(params.commentId) as { userId: string } | undefined
    if (!row) return { ok: false, error: "not_found" }
    if (row.userId !== params.userId) return { ok: false, error: "not_owner" }
    db.prepare(`UPDATE word_comments SET body = ?, editedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(body, params.commentId)
    return { ok: true }
}

// Своё удаление - статус 'deleted', тело стирается: ответы и жалобы на него не теряют место.
export function deleteOwnComment(db: Database.Database, params: { commentId: number; userId: string }): { ok: true } | { ok: false; error: OwnCommentError } {
    const row = db.prepare(`SELECT userId FROM word_comments WHERE id = ? AND status = 'visible'`).get(params.commentId) as { userId: string } | undefined
    if (!row) return { ok: false, error: "not_found" }
    if (row.userId !== params.userId) return { ok: false, error: "not_owner" }
    db.prepare(`UPDATE word_comments SET status = 'deleted', body = '' WHERE id = ?`).run(params.commentId)
    return { ok: true }
}

// Модератор: скрыть (тело остаётся в БД для разбора) или вернуть.
export function setCommentHidden(db: Database.Database, params: { commentId: number; hidden: boolean; moderatorUserId: string; note?: string | null }): boolean {
    const result = params.hidden
        ? db.prepare(`UPDATE word_comments SET status = 'hidden', hiddenByUserId = ?, moderatorNote = ? WHERE id = ? AND status = 'visible'`)
            .run(params.moderatorUserId, params.note ?? null, params.commentId)
        : db.prepare(`UPDATE word_comments SET status = 'visible', hiddenByUserId = NULL, moderatorNote = ? WHERE id = ? AND status = 'hidden'`)
            .run(params.note ?? null, params.commentId)
    return result.changes > 0
}

export interface RecentComment {
    id: number
    lexemeId: number
    isv: string
    userId: string
    excerpt: string
    createdAt: string
}

// Лента последних обсуждений для /contribute.
export function fetchRecentComments(db: Database.Database, limit = 10): RecentComment[] {
    return (db.prepare(`
        SELECT c.id, c.lexemeId, COALESCE(la.value, l.value) AS isv, c.userId, substr(c.body, 1, 140) AS excerpt, c.createdAt
        FROM word_comments c
        JOIN lexemes l ON l.id = c.lexemeId
        LEFT JOIN lexeme_allophones la ON la.lexemeId = l.id AND la.type = 'standard'
            AND la.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE')
        WHERE c.status = 'visible' ORDER BY c.createdAt DESC, c.id DESC LIMIT ?
    `).all(limit) as RecentComment[])
}

// Слияние лексем (lib/dedup/mergeLexemes.ts): обсуждение едет к цели.
export function rewireCommentsLexeme(db: Database.Database, params: { fromLexemeId: number; toLexemeId: number }): void {
    db.prepare(`UPDATE word_comments SET lexemeId = ? WHERE lexemeId = ?`).run(params.toLexemeId, params.fromLexemeId)
}
