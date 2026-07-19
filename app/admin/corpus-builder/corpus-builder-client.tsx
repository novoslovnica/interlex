"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
    SegmentView,
    StatsBar,
    ColorLegend,
    type SegmentResult,
    type Stats,
} from "@/components/CorpusTokenDisplay"

export default function CorpusBuilderClient() {
    const [text, setText] = useState("")
    const [segments, setSegments] = useState<SegmentResult[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [showSaveDialog, setShowSaveDialog] = useState(false)
    const [saveTitle, setSaveTitle] = useState("")
    const [saveSlug, setSaveSlug] = useState("")
    const [saveAuthor, setSaveAuthor] = useState("")
    const [saveMessage, setSaveMessage] = useState("")
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const analyze = useCallback(async (raw: string) => {
        if (!raw.trim()) {
            setSegments([])
            setStats(null)
            return
        }
        setAnalyzing(true)
        try {
            const res = await fetch("/api/corpus/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: raw }),
            })
            if (!res.ok) throw new Error("Analysis failed")
            const data = await res.json()
            setSegments(data.segments || [])
            setStats(data.stats)
        } catch {
            setSegments([])
            setStats(null)
        } finally {
            setAnalyzing(false)
        }
    }, [])

    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    function handleTextChange(value: string) {
        setText(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => analyze(value), 500)
    }

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    async function handleSave() {
        if (!saveTitle || !saveSlug || !text) return
        setSaving(true)
        setSaveMessage("")
        try {
            const res = await fetch("/api/corpus/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: saveTitle,
                    slug: saveSlug,
                    rawText: text,
                    author: saveAuthor || undefined,
                }),
            })
            const data = await res.json()
            if (res.ok) {
                setSaveMessage(`Сохранено: ${data.tokensProcessed} токенов`)
                setShowSaveDialog(false)
                setSaveTitle("")
                setSaveSlug("")
                setSaveAuthor("")
            } else {
                setSaveMessage(`Ошибка: ${data.error}`)
            }
        } catch {
            setSaveMessage("Ошибка сохранения")
        } finally {
            setSaving(false)
        }
    }

    function autoSlug(title: string) {
        return title
            .toLowerCase()
            .replace(/[^a-zа-яё0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 flex flex-col border-r border-border min-w-0">
                    <div className="p-3 border-b border-border bg-muted/30">
                        <label className="text-sm font-medium text-muted-foreground">
                            Вставьте текст для разметки
                        </label>
                    </div>
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => handleTextChange(e.target.value)}
                        className="flex-1 w-full resize-none p-4 bg-transparent text-foreground font-mono text-sm leading-relaxed outline-none"
                        placeholder={"Вставьте текст на межславянском языке...\n\nПример:\nZima je bila hladna. Sněg pokryl vsu zemju. Děti igrali na dvoru."}
                    />
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-3 border-b border-border bg-muted/30 flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground">
                            Разбор текста
                        </span>
                        <StatsBar stats={stats} analyzing={analyzing} />
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed">
                        <SegmentView
                            segments={segments}
                            emptyLabel="Начните вводить текст слева..."
                        />
                    </div>
                </div>
            </div>

            <div className="border-t border-border p-3 flex items-center justify-between bg-muted/20">
                <ColorLegend />
                <button
                    onClick={() => {
                        setSaveTitle("")
                        setSaveSlug("")
                        setSaveAuthor("")
                        setSaveMessage("")
                        setShowSaveDialog(true)
                    }}
                    disabled={!text.trim() || analyzing}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                    Сохранить в корпус
                </button>
            </div>

            {showSaveDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
                        <h2 className="text-lg font-semibold mb-4">Сохранить в корпус</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm text-muted-foreground">Название</label>
                                <input
                                    value={saveTitle}
                                    onChange={(e) => {
                                        setSaveTitle(e.target.value)
                                        if (!saveSlug || saveSlug === autoSlug(saveTitle)) {
                                            setSaveSlug(autoSlug(e.target.value))
                                        }
                                    }}
                                    className="w-full mt-1 px-3 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Название документа"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground">Slug (уникальный идентификатор)</label>
                                <input
                                    value={saveSlug}
                                    onChange={(e) => setSaveSlug(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 bg-muted rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="my-document"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground">Автор (необязательно)</label>
                                <input
                                    value={saveAuthor}
                                    onChange={(e) => setSaveAuthor(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Автор"
                                />
                            </div>
                            {saveMessage && (
                                <p className={`text-sm ${saveMessage.startsWith("Сохранено") ? "text-green-600" : "text-red-500"}`}>
                                    {saveMessage}
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowSaveDialog(false)}
                                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!saveTitle || !saveSlug || saving}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                            >
                                {saving ? "Сохранение..." : "Сохранить"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}