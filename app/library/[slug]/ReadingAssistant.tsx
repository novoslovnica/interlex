"use client"

import { memo, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { isCyrillicText } from "@/lib/orthography/standard"
import { isvToCyr } from "@/lib/isv"
import type { ReadingResult } from "@/lib/library/readingWord"
import { knownReadingLevel, READING_LEVELS, type ReadingLevel, type ReadingWordLevels } from "@/lib/library/readingLevels"
import { MarkdownRenderer } from "./MarkdownRenderer"

const wordSelector = "button[data-reading-word]"
const buttonClass = "rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
const ReadingMarkdown = memo(MarkdownRenderer)

type Lookup = { status: "loading" | "error" } | { status: "ready"; result: ReadingResult }

export function ReadingAssistant({ slug, content, canHighlight }: { slug: string; content: string; canHighlight: boolean }) {
    const t = useTranslations("library.reader")
    const locale = useLocale()
    const language = locale === "ru" || locale === "en" ? locale : "isv"
    const [enabled, setEnabled] = useState(false)
    const [word, setWord] = useState("")
    const [lookup, setLookup] = useState<Lookup>({ status: "loading" })
    const [threshold, setThreshold] = useState<ReadingLevel>()
    const [levels, setLevels] = useState<ReadingWordLevels>()
    const [levelState, setLevelState] = useState<"loading" | "error">()
    const levelRequest = useRef<AbortController | null>(null)
    const trigger = useRef<HTMLButtonElement | null>(null)
    const dialog = useRef<HTMLDialogElement>(null)
    const request = useRef<AbortController | null>(null)
    const dialogId = useId()
    const titleId = useId()
    const thresholdId = useId()

    useEffect(() => () => {
        request.current?.abort()
        levelRequest.current?.abort()
    }, [])

    async function loadLevels() {
        if (levelRequest.current) return
        const controller = new AbortController()
        levelRequest.current = controller
        setLevelState("loading")
        try {
            const params = new URLSearchParams({ slug })
            for (let attempt = 0; attempt < 10 && !controller.signal.aborted; attempt++) {
                const response = await fetch(`/api/library/reading-levels?${params}`, { signal: controller.signal })
                if (response.status === 202) {
                    await new Promise(resolve => setTimeout(resolve, 3000))
                    continue
                }
                if (!response.ok) throw new Error("Reading levels unavailable")
                const data: { levels: ReadingWordLevels } = await response.json()
                if (!controller.signal.aborted) {
                    setLevels(data.levels)
                    setLevelState(undefined)
                }
                return
            }
            if (!controller.signal.aborted) setLevelState("error")
        } catch {
            if (!controller.signal.aborted) setLevelState("error")
        } finally {
            levelRequest.current = null
        }
    }

    async function findWord(surface: string) {
        request.current?.abort()
        const controller = new AbortController()
        request.current = controller
        setLookup({ status: "loading" })
        try {
            const params = new URLSearchParams({ word: surface, lang: language })
            const response = await fetch(`/api/library/reading-word?${params}`, { signal: controller.signal })
            if (!response.ok) throw new Error("Word lookup failed")
            const result: ReadingResult = await response.json()
            if (!controller.signal.aborted) setLookup({ status: "ready", result })
        } catch {
            if (!controller.signal.aborted) setLookup({ status: "error" })
        }
    }

    function setTabStop(container: HTMLElement, target: HTMLButtonElement) {
        const previous = container.querySelector<HTMLButtonElement>(`${wordSelector}[tabindex="0"]`)
        if (previous && previous !== target) previous.tabIndex = -1
        target.tabIndex = 0
    }

    function activate(event: MouseEvent<HTMLDivElement>) {
        if (!(event.target instanceof Element)) return
        const target = event.target.closest<HTMLButtonElement>(wordSelector)
        const surface = target?.dataset.readingWord
        if (!target || !surface) return
        setTabStop(event.currentTarget, target)
        target.focus()
        trigger.current = target
        setWord(surface)
        dialog.current?.showModal()
        void findWord(surface)
    }

    function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
        if (!(event.target instanceof HTMLButtonElement) || !event.target.matches(wordSelector)) return
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
        event.preventDefault()
        const words = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(wordSelector)]
        const current = words.indexOf(event.target)
        const next = event.key === "Home" ? 0
            : event.key === "End" ? words.length - 1
            : current + (event.key === "ArrowRight" ? 1 : -1)
        const target = words[next]
        if (target) {
            setTabStop(event.currentTarget, target)
            target.focus()
        }
    }

    const ready = lookup.status === "ready" ? lookup.result : null
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <button type="button" aria-pressed={enabled} className={`${buttonClass} aria-pressed:bg-muted`} onClick={() => setEnabled(value => !value)}>
                    {t("toggle")}
                </button>
                {enabled && <p className="text-sm text-muted-foreground">{t("instructions")}</p>}
            </div>
            {enabled && canHighlight && (
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={thresholdId} className="text-sm font-medium">{t("highlightLabel")}</label>
                        <select
                            id={thresholdId}
                            value={threshold ?? ""}
                            onChange={event => {
                                const selected = knownReadingLevel(event.target.value)
                                setThreshold(selected)
                                if (selected && !levels) void loadLevels()
                            }}
                            className="max-w-full rounded-lg border bg-background px-2 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
                        >
                            <option value="">{t("highlightOff")}</option>
                            {READING_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                        </select>
                    </div>
                    {threshold && <p role="status" className="text-sm text-muted-foreground">
                        {t(levelState === "loading" ? "highlightLoading" : levelState === "error" ? "highlightError" : "highlightHint")}
                    </p>}
                    {threshold && levelState === "error" && (
                        <button type="button" className={buttonClass} onClick={() => void loadLevels()}>{t("retry")}</button>
                    )}
                </div>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none wrap-break-word" onClick={activate} onKeyDown={moveFocus}>
                <ReadingMarkdown content={content} dialogId={enabled ? dialogId : undefined} levels={levels} threshold={threshold} />
            </div>
            <dialog
                id={dialogId}
                ref={dialog}
                aria-labelledby={titleId}
                onClose={() => {
                    request.current?.abort()
                    if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true })
                }}
                onClick={event => {
                    if (event.target === event.currentTarget) event.currentTarget.close()
                }}
                className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border bg-background p-5 text-foreground shadow-xl backdrop:bg-black/40"
            >
                <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                        <h2 id={titleId} lang="isv" className="min-w-0 break-words text-xl font-bold">{word}</h2>
                        <button type="button" className={buttonClass} onClick={() => dialog.current?.close()}>{t("close")}</button>
                    </div>
                    <div role="status" className="space-y-2">
                        {lookup.status === "loading" && <p>{t("loading")}</p>}
                        {lookup.status === "error" && <p>{t("error")}</p>}
                        {ready?.warmingUp && <p className="text-sm text-muted-foreground">{t("warmingUp")}</p>}
                        {ready && !ready.warmingUp && !ready.entries.length && <p>{t("empty")}</p>}
                        {ready?.entries.length === 1 && <p className="sr-only">{t("found")}</p>}
                        {ready && ready.entries.length > 1 && <p className="text-sm">{t("alternatives")}</p>}
                    </div>
                    {(lookup.status === "error" || ready?.warmingUp) && (
                        <button type="button" className={buttonClass} onClick={() => void findWord(word)}>{t("retry")}</button>
                    )}
                    {ready && ready.entries.length > 0 && (
                        <ul className="space-y-2">
                            {ready.entries.map(entry => (
                                <li key={entry.id} className="space-y-1 rounded-lg border p-3">
                                    <Link href={`/words/${entry.id}`} lang="isv" className="font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">
                                        {isCyrillicText(word) ? isvToCyr(entry.word) : entry.word}
                                    </Link>
                                    {entry.pos && <p className="text-sm text-muted-foreground">
                                        {t.has(`pos.${entry.pos}`) ? t(`pos.${entry.pos}`) : entry.pos}
                                    </p>}
                                    {ready.readings.length > 0 && <p className="text-sm">
                                        {t("forms", { readings: ready.readings.map(reading => reading.split(" ").map(part => t.has(`tags.${part}`) ? t(`tags.${part}`) : part).join(" ")).join(" / ") })}
                                    </p>}
                                    {entry.translations.length > 0
                                        ? <p lang={language}>{entry.translations.join(", ")}</p>
                                        : entry.meanings.length > 0 && <p lang="isv">{entry.meanings.join(" · ")}</p>}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </dialog>
        </div>
    )
}
