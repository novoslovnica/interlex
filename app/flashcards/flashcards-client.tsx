"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { isvToCyr } from "@/lib/isv"
import { ScriptMode } from "@/lib/script-mode"

interface FlashcardsClientProps {
    currentScript: ScriptMode
}

interface FlashcardSessionCard {
    wordId: number
    slug: string
    value: string
    pos: string | null
    cefrLevel: string | null
    translation: string | null
    isReview: boolean
}

type ReviewButton = "again" | "hard" | "good" | "easy"

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]

const REVIEW_BUTTONS: { key: ReviewButton; className: string }[] = [
    { key: "again", className: "bg-red-500/10 border-red-500/40 text-red-600 hover:bg-red-500/20" },
    { key: "hard", className: "bg-orange-500/10 border-orange-500/40 text-orange-600 hover:bg-orange-500/20" },
    { key: "good", className: "bg-blue-500/10 border-blue-500/40 text-blue-600 hover:bg-blue-500/20" },
    { key: "easy", className: "bg-green-500/10 border-green-500/40 text-green-600 hover:bg-green-500/20" },
]

export function FlashcardsClient({ currentScript }: FlashcardsClientProps) {
    const t = useTranslations("flashcards")
    const [level, setLevel] = useState<string>("")
    const [cards, setCards] = useState<FlashcardSessionCard[] | null>(null)
    const [index, setIndex] = useState(0)
    const [flipped, setFlipped] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [reviewing, setReviewing] = useState(false)
    const [reviewedCount, setReviewedCount] = useState(0)

    const displayValue = (value: string) => {
        return currentScript === ScriptMode.CYRILLIC ? isvToCyr(value) : value
    }

    const startSession = async () => {
        setLoading(true)
        setError(null)
        setCards(null)
        setIndex(0)
        setFlipped(false)
        setReviewedCount(0)
        try {
            const params = new URLSearchParams()
            if (level) params.set("cefrLevel", level)
            const res = await fetch(`/api/flashcards/session?${params.toString()}`)
            if (!res.ok) throw new Error("request failed")
            const data = await res.json()
            setCards(Array.isArray(data.cards) ? data.cards : [])
        } catch {
            setError(t("error"))
        } finally {
            setLoading(false)
        }
    }

    const handleReview = async (button: ReviewButton) => {
        if (!cards || reviewing) return
        const card = cards[index]
        setReviewing(true)
        try {
            await fetch("/api/flashcards/review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wordId: card.wordId, button }),
            })
        } catch {
            // Non-fatal: the session continues locally even if this single
            // review fails to persist - the card will simply reappear in a
            // future session unchanged.
        } finally {
            setReviewedCount((c) => c + 1)
            setFlipped(false)
            setIndex((i) => i + 1)
            setReviewing(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                <p className="text-muted-foreground text-sm">{t("description")}</p>
            </div>

            {!cards && (
                <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            {t("levelLabel")}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setLevel("")}
                                className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                                    level === "" ? "bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/20" : "bg-background border-border hover:bg-muted/40"
                                }`}
                            >
                                {t("anyLevel")}
                            </button>
                            {CEFR_LEVELS.map((lvl) => (
                                <button
                                    key={lvl}
                                    onClick={() => setLevel(lvl)}
                                    className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                                        level === lvl ? "bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/20" : "bg-background border-border hover:bg-muted/40"
                                    }`}
                                >
                                    {lvl}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={startSession}
                        disabled={loading}
                        className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {loading ? t("loading") : t("start")}
                    </button>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
            )}

            {cards && cards.length === 0 && (
                <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60 text-center space-y-4">
                    <p className="text-muted-foreground">{t("empty")}</p>
                    <button
                        onClick={() => setCards(null)}
                        className="px-4 py-2 rounded-lg border border-border hover:bg-muted/40 text-sm font-medium"
                    >
                        {t("newSession")}
                    </button>
                </div>
            )}

            {cards && cards.length > 0 && index >= cards.length && (
                <div className="border rounded-xl bg-background p-8 shadow-sm border-border/60 text-center space-y-4">
                    <h2 className="text-xl font-bold">{t("sessionComplete")}</h2>
                    <p className="text-muted-foreground">{t("sessionCompleteDescription", { count: reviewedCount })}</p>
                    <button
                        onClick={() => setCards(null)}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
                    >
                        {t("newSession")}
                    </button>
                </div>
            )}

            {cards && cards.length > 0 && index < cards.length && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{t("progress", { current: index + 1, total: cards.length })}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${cards[index].isReview ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                            {cards[index].isReview ? t("due") : t("new")}
                        </span>
                    </div>

                    <div
                        onClick={() => !flipped && setFlipped(true)}
                        className="border rounded-2xl bg-background p-10 shadow-sm border-border/60 min-h-[220px] flex flex-col items-center justify-center gap-4 cursor-pointer select-none text-center"
                    >
                        <div className="text-3xl font-bold tracking-tight">{displayValue(cards[index].value)}</div>
                        {cards[index].pos && <div className="text-xs text-muted-foreground uppercase tracking-wider">{cards[index].pos}</div>}
                        {flipped ? (
                            <div className="text-xl text-foreground/90 pt-2 border-t border-border/60 w-full">
                                {cards[index].translation || "—"}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground pt-2">{t("showAnswer")}</div>
                        )}
                    </div>

                    {flipped && (
                        <div className="grid grid-cols-4 gap-2">
                            {REVIEW_BUTTONS.map(({ key, className }) => (
                                <button
                                    key={key}
                                    onClick={() => handleReview(key)}
                                    disabled={reviewing}
                                    className={`py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${className}`}
                                >
                                    {t(key)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
