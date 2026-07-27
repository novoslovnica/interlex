"use client"

import { useState, useEffect, useCallback } from "react"

interface LangObject {
    id: number
    value: string | null
    verified: number | null
    message: string | null
    wordId: number | null
    meaningId: number | null
}

interface CardData {
    done: boolean
    lexeme?: { id: number; value: string | null; slug: string | null; pos: string | null }
    allophoneId?: number
    coreValue?: string
    meaningText?: string | null
    examples?: string | null
    ru?: LangObject[]
    en?: LangObject[]
}

function getTranslationValue(items: LangObject[] | undefined): string | null {
    if (!items || items.length === 0) return null
    return items[0].value || null
}

export default function WordCardsClient() {
    const [card, setCard] = useState<CardData | null>(null)
    const [loading, setLoading] = useState(false)
    const [inputValue, setInputValue] = useState("")
    const [actionLoading, setActionLoading] = useState(false)

    const fetchRandom = useCallback(async () => {
        setLoading(true)
        setCard(null)
        try {
            const res = await fetch(`/api/word-cards/random`)
            const data: CardData = await res.json()
            setCard(data)
            setInputValue(data.coreValue || "")
        } catch {
            alert("Не удалось загрузить карточку")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchRandom()
    }, [fetchRandom])

    const save = async (verified: 0 | 1) => {
        if (!card || card.done || !card.lexeme) return
        setActionLoading(true)
        try {
            const res = await fetch(`/api/lexicon/${card.lexeme.id}/updateField`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    field: "isv",
                    verified,
                    newValue: inputValue,
                }),
            })
            if (!res.ok) throw new Error("Save failed")
            await fetchRandom()
        } catch {
            alert("Не удалось сохранить")
        } finally {
            setActionLoading(false)
        }
    }

    const handleApprove = () => save(1)
    const handleReject = () => save(0)
    const handleSkip = async () => {
        if (!card || card.done) return
        await fetchRandom()
    }

    return (
        <div className="container mx-auto px-4 py-6">
            <div className="mb-6">
                <h1 className="text-lg font-semibold">Верификация слов (CORE)</h1>
                <p className="text-sm text-muted-foreground">
                    Проверка и правка основной (CORE) флаворизации слова.
                </p>
            </div>

            {loading && (
                <div className="text-center text-muted-foreground py-12">
                    Загрузка...
                </div>
            )}

            {!loading && card?.done && (
                <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground">
                        Пока нет неверифицированных слов.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                        Все CORE-флаворизации проверены.
                    </p>
                </div>
            )}

            {!loading && card && !card.done && card.lexeme && (
                <div className="max-w-xl mx-auto">
                    <div className="bg-card border rounded-xl shadow-sm p-6">
                        <div className="text-center mb-4">
                            {card.lexeme.pos && (
                                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                                    {card.lexeme.pos}
                                </div>
                            )}
                            <a
                                href={`/admin/words/${card.lexeme.id}/edit`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary hover:underline"
                            >
                                Открыть в редакторе (ID: {card.lexeme.id}) →
                            </a>
                        </div>

                        <div className="mb-6 text-sm text-muted-foreground border-l-2 border-muted pl-3">
                            {card.meaningText && (
                                <div className="text-xs italic mb-1">{card.meaningText}</div>
                            )}
                            <div className="flex gap-4 text-xs">
                                <span>
                                    <span className="font-medium text-foreground">RU:</span>{" "}
                                    {getTranslationValue(card.ru) || "—"}
                                </span>
                                <span>
                                    <span className="font-medium text-foreground">EN:</span>{" "}
                                    {getTranslationValue(card.en) || "—"}
                                </span>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                Слово (CORE)
                            </label>
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-2xl font-bold text-center bg-background text-foreground dark:bg-gray-800 dark:border-gray-700"
                                placeholder="Слово..."
                            />
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={handleApprove}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                                ✓ Одобрить
                            </button>
                            <button
                                onClick={handleReject}
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
        </div>
    )
}
