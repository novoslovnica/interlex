import { describe, it, expect, beforeEach } from "vitest"
import type Database from "better-sqlite3"
import { createDb } from "./testDb"
import { createComment, fetchCommentTree, countVisibleComments, editOwnComment, deleteOwnComment, setCommentHidden, checkCommentAllowance, fetchRecentComments, rewireCommentsLexeme } from "./comments"

function seed(db: Database.Database) {
    db.exec(`
        CREATE TABLE word_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, lexemeId INTEGER NOT NULL, parentId INTEGER, userId TEXT NOT NULL,
            body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'visible', hiddenByUserId TEXT, moderatorNote TEXT,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, editedAt DATETIME);
    `)
}

describe("word comments", () => {
    let db: Database.Database
    beforeEach(() => { db = createDb(); seed(db) })

    it("builds a one-level tree and refuses deeper replies, empty and foreign parents", () => {
        const root = createComment(db, { lexemeId: 1, userId: "a", body: " Root " })
        expect(root.ok && root.comment.body).toBe("Root")
        const reply = createComment(db, { lexemeId: 1, userId: "b", body: "Reply", parentId: root.ok ? root.comment.id : 0 })
        expect(reply.ok).toBe(true)
        expect(createComment(db, { lexemeId: 1, userId: "c", body: "x", parentId: reply.ok ? reply.comment.id : 0 })).toEqual({ ok: false, error: "too_deep" })
        expect(createComment(db, { lexemeId: 2, userId: "c", body: "x", parentId: root.ok ? root.comment.id : 0 })).toEqual({ ok: false, error: "parent_not_found" })
        expect(createComment(db, { lexemeId: 1, userId: "c", body: "   " })).toEqual({ ok: false, error: "empty" })
        expect(createComment(db, { lexemeId: 3, userId: "c", body: "x" })).toEqual({ ok: false, error: "lexeme_not_found" }) // isPublic=0
        const tree = fetchCommentTree(db, 1)
        expect(tree).toHaveLength(1)
        expect(tree[0].replies.map((r) => r.body)).toEqual(["Reply"])
        expect(countVisibleComments(db, 1)).toBe(2)
    })

    it("hides a comment's body and author but keeps its replies; drops it entirely when childless", () => {
        const root = createComment(db, { lexemeId: 1, userId: "a", body: "bad" })
        const id = root.ok ? root.comment.id : 0
        createComment(db, { lexemeId: 1, userId: "b", body: "reply", parentId: id })
        createComment(db, { lexemeId: 1, userId: "c", body: "lonely" })
        expect(setCommentHidden(db, { commentId: id, hidden: true, moderatorUserId: "mod", note: "spam" })).toBe(true)
        expect(setCommentHidden(db, { commentId: id, hidden: true, moderatorUserId: "mod" })).toBe(false)
        const tree = fetchCommentTree(db, 1)
        expect(tree[0]).toMatchObject({ id, status: "hidden", body: null, userId: null })
        expect(tree[0].replies).toHaveLength(1)
        expect(deleteOwnComment(db, { commentId: 3, userId: "c" })).toEqual({ ok: true })
        expect(fetchCommentTree(db, 1)).toHaveLength(1)
        expect(countVisibleComments(db, 1)).toBe(1)
        expect(db.prepare(`SELECT body, status FROM word_comments WHERE id = ?`).get(id)).toEqual({ body: "bad", status: "hidden" }) // текст остаётся для разбора
    })

    it("lets only the author edit or delete, and only while visible", () => {
        const c = createComment(db, { lexemeId: 1, userId: "a", body: "v1" })
        const id = c.ok ? c.comment.id : 0
        expect(editOwnComment(db, { commentId: id, userId: "b", body: "v2" })).toEqual({ ok: false, error: "not_owner" })
        expect(editOwnComment(db, { commentId: id, userId: "a", body: "v2" })).toEqual({ ok: true })
        expect(db.prepare(`SELECT body, editedAt IS NOT NULL AS edited FROM word_comments WHERE id = ?`).get(id)).toEqual({ body: "v2", edited: 1 })
        setCommentHidden(db, { commentId: id, hidden: true, moderatorUserId: "mod" })
        expect(editOwnComment(db, { commentId: id, userId: "a", body: "v3" })).toEqual({ ok: false, error: "not_found" })
        expect(setCommentHidden(db, { commentId: id, hidden: false, moderatorUserId: "mod" })).toBe(true)
        expect(deleteOwnComment(db, { commentId: id, userId: "a" })).toEqual({ ok: true })
    })

    it("rate-limits newcomers harder than contributors", () => {
        for (let i = 0; i < 2; i++) createComment(db, { lexemeId: 1, userId: "new", body: `n${i}` })
        expect(checkCommentAllowance(db, "new")).toEqual({ allowed: false, retryAfterMinutes: 60 })
        db.prepare(`INSERT INTO contributor_stats (userId, language, votesTotal) VALUES ('vet', 'pl', 3)`).run()
        for (let i = 0; i < 4; i++) createComment(db, { lexemeId: 1, userId: "vet", body: `v${i}` })
        expect(checkCommentAllowance(db, "vet")).toEqual({ allowed: true, retryAfterMinutes: 10 })
        createComment(db, { lexemeId: 1, userId: "vet", body: "v5" })
        expect(checkCommentAllowance(db, "vet").allowed).toBe(false)
    })

    it("lists recent visible comments with the word and follows a lexeme merge", () => {
        createComment(db, { lexemeId: 2, userId: "a", body: "about redky" })
        createComment(db, { lexemeId: 1, userId: "b", body: "about voda" })
        expect(fetchRecentComments(db, 5).map((c) => [c.isv, c.excerpt])).toEqual([["voda", "about voda"], ["redky", "about redky"]])
        rewireCommentsLexeme(db, { fromLexemeId: 2, toLexemeId: 1 })
        expect(countVisibleComments(db, 1)).toBe(2)
    })
})
