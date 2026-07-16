"use client"

import { useState, useEffect, useCallback } from "react"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import { createPortal } from "react-dom"

interface LangObject {
    id: number
    value: string | null
    veryfied: number | null
    message: string | null
    wordId: number | null
    meaningId: number | null
}

interface LexemeData {
    id: number
    value: string | null
    slug: string | null
    isv: string | null
}

interface MeaningData {
    id: number
    meaning: string | null
    examples: string | null
}

interface CardData {
    done: boolean
    lexeme?: LexemeData
    meanings?: MeaningData[]
    ru?: LangObject[]
    en?: LangObject[]
    target?: LangObject[]
    currentMeaningId?: number
    meaningText?: string | null
}

function RejectDialog({
    open,
    onClose,
    onConfirm,
    initialMessage,
}: {
    open: boolean
    onClose: () => void
    onConfirm: (message: string) => void
    initialMessage: string
}) {
    const [text, setText] = useState(initialMessage)

    useEffect(() => {
        if (open) setText(initialMessage)
    }, [open, initialMessage])

    if (!open) return null

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={onClose}
        >
            <div
                className="dark:bg-gray-800 dark:text-gray-100 bg-white rounded-lg shadow-xl p-4 w-80"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-sm font-semibold mb-2">Комментарий к отклонению</h3>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm resize-none h-20 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    placeholder="Укажите причину отклонения..."
                    autoFocus
                />
                <div className="flex justify-end gap-2 mt-3">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs rounded border dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300 hover:bg-gray-100"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={() => onConfirm(text)}
                        className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                    >
                        Отклонить
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

export default function TranslationCardsClient({
    currentLanguage,
    userRole,
    userPermissions = [],
}: {
    currentLanguage: string
    userRole: string
    userPermissions: string[]
}) {
    const availableLangs = userRole === "ADMIN"
        ? [...TRANSLATION_LANGUAGES]
        : TRANSLATION_LANGUAGES.filter(l => userPermissions.includes(`translate_${l.code}`))
    const defaultLang = availableLangs.some(l => l.code === currentLanguage)
        ? currentLanguage
        : availableLangs.length > 0 ? availableLangs[0].code : "ru"
    const [selectedLang, setSelectedLang] = useState(defaultLang)
    const [card, setCard] = useState<CardData | null>(null)
    const [loading, setLoading] = useState(false)
    const [inputValue, setInputValue] = useState("")
    const [showRejectDialog, setShowRejectDialog] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)

    const fetchRandom = useCallback(async (lang: string) => {
        setLoading(true)
        setCard(null)
        try {
            const res = await fetch(`/api/translation-cards/random?lang=${lang}`)
            const data: CardData = await res.json()
            setCard(data)
            if (!data.done && data.target && data.target.length > 0) {
                setInputValue(data.target[0].value || "")
            } else {
                setInputValue("")
            }
        } catch {
            alert("Не удалось загрузить карточку")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchRandom(selectedLang)
    }, [selectedLang, fetchRandom])

    const handleApprove = async () => {
        if (!card || card.done || !card.currentMeaningId) return
        setActionLoading(true)
        const targetEntry = card.target && card.target.length > 0 ? card.target[0] : null

        try {
            const body: Record<string, unknown> = {
                field: selectedLang,
                veryfied: 1,
                meaningId: card.currentMeaningId,
            }
            if (targetEntry) {
                body.translationId = targetEntry.id
                if (inputValue !== targetEntry.value) {
                    body.newValue = inputValue
                }
            } else if (inputValue) {
                body.newValue = inputValue
            }

            await fetch(`/api/lexicon/${card.lexeme!.id}/updateField`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })

            await fetchRandom(selectedLang)
        } catch {
            alert("Не удалось сохранить")
        } finally {
            setActionLoading(false)
        }
    }

    const handleReject = async (message: string) => {
        if (!card || card.done || !card.currentMeaningId) return
        setActionLoading(true)
        setShowRejectDialog(false)
        const targetEntry = card.target && card.target.length > 0 ? card.target[0] : null

        try {
            const body: Record<string, unknown> = {
                field: selectedLang,
                veryfied: 0,
                message,
                meaningId: card.currentMeaningId,
            }
            if (targetEntry) {
                body.translationId = targetEntry.id
            }

            await fetch(`/api/lexicon/${card.lexeme!.id}/updateField`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })

            await fetchRandom(selectedLang)
        } catch {
            alert("Не удалось сохранить")
        } finally {
            setActionLoading(false)
        }
    }

    const handleSkip = async () => {
        if (!card || card.done) return
        await fetchRandom(selectedLang)
    }

    const getTranslationValue = (items: LangObject[] | undefined): string | null => {
        if (!items || items.length === 0) return null
        return items[0].value || null
    }

    return (
        <div className="container mx-auto px-4 py-6">
            <div className="mb-6">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Язык перевода
                </label>
                <select
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value)}
                    className="border rounded px-3 py-2 text-sm bg-background text-foreground dark:bg-gray-800 dark:border-gray-700"
                >
                    {availableLangs.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                            {lang.flag} {lang.name}
                        </option>
                    ))}
                </select>
            </div>

            {loading && (
                <div className="text-center text-muted-foreground py-12">
                    Загрузка...
                </div>
            )}

            {!loading && card?.done && (
                <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground">
                        Пока нет неверифицированных переводов на данный язык.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                        Все переводы на &laquo;{TRANSLATION_LANGUAGES.find(l => l.code === selectedLang)?.name}&raquo; проверены.
                    </p>
                </div>
            )}

            {!loading && card && !card.done && card.lexeme && (
                <div className="max-w-xl mx-auto">
                    <div className="bg-card border rounded-xl shadow-sm p-6">
                        <div className="text-center mb-4">
                            <div className="text-3xl font-bold text-foreground">
                                {card.lexeme.isv || card.lexeme.value}
                            </div>
                        </div>

                        <div className="space-y-3 mb-6 text-sm text-muted-foreground">
                            {card.meanings?.map((m) => (
                                <div key={m.id} className="border-l-2 border-muted pl-3">
                                    {m.meaning && (
                                        <div className="text-xs italic mb-1">{m.meaning}</div>
                                    )}
                                    <div className="flex gap-4 text-xs">
                                        <span>
                                            <span className="font-medium text-foreground">RU:</span>{" "}
                                            {getTranslationValue(
                                                card.ru?.filter((r) => r.meaningId === m.id)
                                            ) || "—"}
                                        </span>
                                        <span>
                                            <span className="font-medium text-foreground">EN:</span>{" "}
                                            {getTranslationValue(
                                                card.en?.filter((e) => e.meaningId === m.id)
                                            ) || "—"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                Перевод на{" "}
                                {TRANSLATION_LANGUAGES.find((l) => l.code === selectedLang)?.name}
                            </label>
                            <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-20 bg-background text-foreground dark:bg-gray-800 dark:border-gray-700"
                                placeholder="Введите перевод..."
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleApprove}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                                ✓ Одобрить
                            </button>
                            <button
                                onClick={() => setShowRejectDialog(true)}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                ✕ Отклонить
                            </button>
                            <button
                                onClick={handleSkip}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
                            >
                                ↪ Пропустить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <RejectDialog
                open={showRejectDialog}
                onClose={() => setShowRejectDialog(false)}
                onConfirm={handleReject}
                initialMessage=""
            />
        </div>
    )
}