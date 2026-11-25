"use client"

import { useActionState, useId, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { writeWordNote } from "@/app/profile/word-note-actions"
import { WORD_NOTE_LIMIT } from "@/lib/word-note-limit"

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
const button = `rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50 ${focus}`

export function WordNoteEditor({ wordId, initialBody, label, canSave = true, focusFallbackId }: {
    wordId: number
    initialBody: string
    label: string
    canSave?: boolean
    focusFallbackId?: string
}) {
    const t = useTranslations("wordNotes")
    const id = useId()
    const editor = useRef<HTMLTextAreaElement>(null)
    const [body, setBody] = useState(initialBody)
    const [saved, setSaved] = useState(initialBody)
    const [status, submit, pending] = useActionState(async (_: string, form: FormData) => {
        try {
            const result = await writeWordNote(wordId, form)
            if (result.status === "saved" || result.status === "deleted") {
                setBody(result.body)
                setSaved(result.body)
            }
            return result.status
        } catch {
            return "error"
        } finally {
            requestAnimationFrame(() => {
                const target = editor.current?.isConnected
                    ? editor.current
                    : focusFallbackId ? document.getElementById(focusFallbackId) : null
                target?.focus()
            })
        }
    }, "")

    return (
        <form action={submit} className="space-y-2">
            <label htmlFor={id} className="sr-only">{label}</label>
            <textarea
                ref={editor}
                id={id}
                name="body"
                rows={3}
                value={body}
                onChange={event => setBody(event.target.value)}
                readOnly={pending || !canSave}
                maxLength={WORD_NOTE_LIMIT}
                className={`block w-full min-w-0 rounded-lg border bg-background p-2 text-foreground ${focus}`}
            />
            <div className="flex flex-wrap gap-2">
                {canSave && (
                    <button type="submit" name="intent" value="save" className={button} disabled={pending || !body.trim() || body.trim() === saved}>
                        {t("save")}
                    </button>
                )}
                {saved && (
                    <button type="submit" name="intent" value="delete" className={button} disabled={pending}>
                        {t("delete")}
                    </button>
                )}
            </div>
            <p role="status" className="text-sm">{status && t(`status.${status}`)}</p>
        </form>
    )
}
