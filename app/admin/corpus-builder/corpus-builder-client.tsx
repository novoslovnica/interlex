"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface TokenResult {
    surfaceForm: string
    isPunctuation: boolean
    isRecognized: boolean
    isPartialMatch: boolean
    lemma: string
    pos: string
    wordSlug: string | null
    feats: Record<string, string>
    matchCount: number
}

interface SentenceResult {
    position: number
    rawText: string
    tokens: TokenResult[]
}

interface Stats {
    totalTokens: number
    recognizedWords: number
    unrecognizedWords: number
    punctuationCount: number
}

const FEAT_LABELS: Record<string, string> = {
    nom: "nom", gen: "gen", dat: "dat", acc: "acc", ins: "ins", loc: "loc", voc: "voc",
    sg: "sg", du: "du", pl: "pl",
    masc: "m", fem: "f", neut: "n",
    anim: "anim", inanim: "inanim",
    pres: "pres", past: "past", fut: "fut", aor: "aor", impf: "impf",
    ind: "ind", imp: "imp", sub: "sub",
    act: "act", pass: "pass",
    inf: "inf", fin: "fin", part: "part", ger: "ger",
    pos: "pos", comp: "comp", sup: "sup",
}

function formatFeats(feats: Record<string, string>): string {
    const parts: string[] = []
    const order = ["case", "number", "gender", "person", "tense", "mood", "voice", "verbForm", "degree", "animacy"]
    for (const key of order) {
        const val = feats[key]
        if (val) {
            parts.push(FEAT_LABELS[val] ?? val)
        }
    }
    return parts.join(" ")
}

function TokenBlock({ token }: { token: TokenResult }) {
    let bgColor = ""
    if (token.isPunctuation) {
        bgColor = "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
    } else if (token.isRecognized) {
        bgColor = "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300"
    } else if (token.isPartialMatch) {
        bgColor = "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300"
    } else {
        bgColor = "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
    }

    const featsStr = token.isRecognized ? formatFeats(token.feats) : ""
    const hasHomonymy = token.matchCount > 1

    return (
        <span className="inline-flex flex-col items-stretch mx-0.5 my-0.5">
            <span className="text-[10px] leading-tight text-center px-1 text-muted-foreground relative min-h-[14px]">
                {featsStr || (
                    <span className="text-[10px] text-muted-foreground/40">&mdash;</span>
                )}
                {hasHomonymy && (
                    <span className="absolute -top-0.5 -right-1 text-[9px] font-bold text-amber-500 dark:text-amber-400">
                        +{token.matchCount - 1}
                    </span>
                )}
            </span>
            <span
                className={`inline-block px-2 py-0.5 rounded-md text-sm font-mono leading-tight whitespace-nowrap ${bgColor}`}
                title={
                    token.isRecognized
                        ? `${token.lemma} (${token.pos}) [${token.wordSlug}]`
                        : token.isPartialMatch
                            ? `основа найдена: ${token.wordSlug}, но флексия не найдена`
                            : token.isPunctuation
                                ? "пунктуация"
                                : `не найдено в словаре: ${token.lemma}`
                }
            >
                {token.surfaceForm}
            </span>
        </span>
    )
}

export default function CorpusBuilderClient() {
    const [text, setText] = useState("")
    const [sentences, setSentences] = useState<SentenceResult[]>([])
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
            setSentences([])
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
            setSentences(data.sentences)
            setStats(data.stats)
        } catch {
            setSentences([])
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
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex flex-1 min-h-0">
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
                        {analyzing && (
                            <span className="text-xs text-muted-foreground animate-pulse">
                                Анализ...
                            </span>
                        )}
                        {stats && !analyzing && (
                            <span className="text-xs text-muted-foreground">
                                {stats.totalTokens} токенов ·
                                <span className="text-green-600 dark:text-green-400 ml-1">{stats.recognizedWords}</span>
                                <span className="text-yellow-500 ml-1">{stats.totalTokens - stats.recognizedWords - stats.unrecognizedWords - stats.punctuationCount}</span>
                                <span className="text-red-500 ml-1">{stats.unrecognizedWords}</span>
                                <span className="text-gray-400 ml-1">/{stats.punctuationCount}</span>
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed">
                        {sentences.length === 0 && !analyzing && (
                            <p className="text-muted-foreground italic">
                                Начните вводить текст слева...
                            </p>
                        )}
                        {sentences.map((s) => (
                            <div key={s.position} className="mb-5 flex flex-wrap items-baseline">
                                {s.tokens.map((t, i) => (
                                    <TokenBlock key={i} token={t} />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="border-t border-border p-3 flex items-center justify-between bg-muted/20">
                <div className="text-xs text-muted-foreground flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded-sm bg-green-100 dark:bg-green-900/40 border border-green-500" />
                        распознано
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded-sm bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-500" />
                        основа найдена
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded-sm bg-red-100 dark:bg-red-900/40 border border-red-500" />
                        не найдено
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700 border border-gray-400" />
                        пунктуация
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-amber-500">+1</span>
                        омонимия
                    </span>
                </div>
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