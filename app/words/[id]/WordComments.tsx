"use client"

import { useState } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import ReportErrorModal from "@/components/ReportErrorModal"
import type { CommentThread, CommentView } from "@/lib/community/loadComments"
import { COMMENT_MAX_LENGTH } from "@/lib/community/constants"

// Смотрящий: null - аноним; handle null - вошёл, но ника нет (читать
// можно, писать - после выбора ника в настройках).
export interface CommentViewer {
    handle: string | null
}

interface WordCommentsProps {
    lexemeId: number
    initial: CommentThread
    viewer: CommentViewer | null
}

const BUTTON = "text-xs px-3 py-1.5 rounded-lg border font-medium disabled:opacity-50"

export default function WordComments({ lexemeId, initial, viewer }: WordCommentsProps) {
    const t = useTranslations("word.comments")
    const locale = useLocale()
    const [thread, setThread] = useState(initial)
    const [error, setError] = useState<string | null>(null)

    const reload = async () => {
        const response = await fetch(`/api/words/${lexemeId}/comments`)
        if (response.ok) setThread(await response.json())
    }
    const fail = (code: string) => setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic"))

    const post = async (body: string, parentId: number | null) => {
        setError(null)
        const response = await fetch(`/api/words/${lexemeId}/comments`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, parentId }),
        })
        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            fail(response.status === 429 ? "rate_limited" : (data.error ?? "generic"))
            return false
        }
        await reload()
        return true
    }
    const edit = async (id: number, body: string) => {
        setError(null)
        const response = await fetch(`/api/community/comments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) })
        if (!response.ok) { fail("generic"); return false }
        await reload()
        return true
    }
    const remove = async (id: number) => {
        if (!confirm(t("deleteConfirm"))) return
        setError(null)
        const response = await fetch(`/api/community/comments/${id}`, { method: "DELETE" })
        if (!response.ok) { fail("generic"); return }
        await reload()
    }

    const date = (value: string) => new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z")).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })

    const renderComment = (comment: CommentView, depth: number) => (
        <li key={comment.id} className={depth > 0 ? "ml-6 mt-2" : ""}>
            <CommentItem comment={comment} viewer={viewer} lexemeId={lexemeId} date={date} onReply={depth === 0 ? (body) => post(body, comment.id) : undefined} onEdit={edit} onDelete={remove} />
            {comment.replies.length > 0 && <ul>{comment.replies.map((reply) => renderComment(reply, depth + 1))}</ul>}
        </li>
    )

    return (
        <div className="space-y-4">
            {thread.comments.length === 0 && <p className="text-sm text-slate-400">{t("empty")}</p>}
            <ul className="space-y-3">{thread.comments.map((comment) => renderComment(comment, 0))}</ul>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {viewer === null && <p className="text-xs text-slate-400">{t("loginToWrite")}</p>}
            {viewer && viewer.handle === null && (
                <p className="text-xs text-slate-400">{t("handleRequired")} <Link href="/settings" className="text-blue-600">{t("chooseHandle")}</Link></p>
            )}
            {viewer?.handle && <CommentForm onSubmit={(body) => post(body, null)} submitLabel={t("send")} placeholder={t("placeholder")} />}
        </div>
    )
}

function CommentForm({ onSubmit, submitLabel, placeholder, initial = "", onCancel }: {
    onSubmit: (body: string) => Promise<boolean>
    submitLabel: string
    placeholder?: string
    initial?: string
    onCancel?: () => void
}) {
    const t = useTranslations("word.comments")
    const [body, setBody] = useState(initial)
    const [busy, setBusy] = useState(false)
    return (
        <form
            onSubmit={async (e) => {
                e.preventDefault()
                if (busy || body.trim() === "") return
                setBusy(true)
                try {
                    if (await onSubmit(body)) { setBody(""); onCancel?.() }
                } finally {
                    setBusy(false)
                }
            }}
            className="space-y-2"
        >
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={COMMENT_MAX_LENGTH}
                rows={3}
                placeholder={placeholder}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            />
            <div className="flex gap-2">
                <button type="submit" disabled={busy || body.trim() === ""} className={`${BUTTON} bg-blue-600 text-white border-blue-600`}>{submitLabel}</button>
                {onCancel && <button type="button" onClick={onCancel} className={`${BUTTON} border-slate-200`}>{t("cancel")}</button>}
            </div>
        </form>
    )
}

function CommentItem({ comment, viewer, lexemeId, date, onReply, onEdit, onDelete }: {
    comment: CommentView
    viewer: CommentViewer | null
    lexemeId: number
    date: (value: string) => string
    onReply?: (body: string) => Promise<boolean>
    onEdit: (id: number, body: string) => Promise<boolean>
    onDelete: (id: number) => Promise<void>
}) {
    const t = useTranslations("word.comments")
    const [mode, setMode] = useState<"view" | "reply" | "edit">("view")

    if (comment.status !== "visible") {
        return <p className="text-xs italic text-slate-400">{t(comment.status === "hidden" ? "hiddenByModerator" : "deletedByAuthor")}</p>
    }
    return (
        <div className="text-sm">
            <p className="text-xs text-slate-400">
                {comment.handle ? <Link href={`/u/${comment.handle}`} className="text-blue-600 font-medium">@{comment.handle}</Link> : <span>{t("anonymous")}</span>}
                {" · "}{date(comment.createdAt)}{comment.editedAt && ` · ${t("edited")}`}
            </p>
            {mode === "edit" ? (
                <CommentForm initial={comment.body ?? ""} submitLabel={t("save")} onSubmit={(body) => onEdit(comment.id, body)} onCancel={() => setMode("view")} />
            ) : (
                <p className="text-slate-700 whitespace-pre-line break-words">{comment.body}</p>
            )}
            {mode === "view" && (
                <div className="flex items-center gap-3 mt-1 text-xs">
                    {viewer?.handle && onReply && <button type="button" onClick={() => setMode("reply")} className="text-blue-600">{t("reply")}</button>}
                    {comment.own && <button type="button" onClick={() => setMode("edit")} className="text-slate-500">{t("edit")}</button>}
                    {comment.own && <button type="button" onClick={() => onDelete(comment.id)} className="text-red-600">{t("delete")}</button>}
                    {!comment.own && (
                        <ReportErrorModal entityType="Comment" entityId={comment.id} lexemeId={lexemeId} reportedValue={(comment.body ?? "").slice(0, 500)} className="shrink-0" />
                    )}
                </div>
            )}
            {mode === "reply" && onReply && (
                <div className="mt-2"><CommentForm submitLabel={t("send")} placeholder={t("replyPlaceholder")} onSubmit={onReply} onCancel={() => setMode("view")} /></div>
            )}
        </div>
    )
}
