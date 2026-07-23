"use client"

import { useState, useTransition, useEffect } from "react"
import type { WordItem } from "./page"

interface SimpleMeaning {
    id: number
    meaning: string | null
    word: {
        id: number
        value: string | null
    }
}

interface TargetMeaning {
    id: number
    meaning: string | null
    lexeme: { id: number; value: string | null }
}

function toSimpleMeaning(t: TargetMeaning): SimpleMeaning {
    return { id: t.id, meaning: t.meaning, word: { id: t.lexeme.id, value: t.lexeme.value } }
}

function toTargetMeaning(s: SimpleMeaning): TargetMeaning {
    return { id: s.id, meaning: s.meaning, lexeme: { id: s.word.id, value: s.word.value } }
}

interface AntonymsClientProps {
    initialWords: WordItem[]
    onUpdateAntonyms: (sourceMeaningId: number, targetMeaningIds: number[]) => Promise<void>
}

export function AntonymsClient({ initialWords, onUpdateAntonyms }: AntonymsClientProps) {
    const [words, setWords] = useState<WordItem[]>(initialWords)
    const [selectedWordId, setSelectedWordId] = useState<number | null>(initialWords[0]?.id || null)
    const [selectedMeaningId, setSelectedMeaningId] = useState<number | null>(
        initialWords[0]?.meanings[0]?.id || null
    )
    const [isPending, startTransition] = useTransition()

    const [rootSearchQuery, setRootSearchQuery] = useState("")
    const [rootSearchResults, setRootSearchResults] = useState<SimpleMeaning[]>([])
    const [isSearchingRoot, setIsSearchingRoot] = useState(false)

    const [antonymSearchQuery, setAntonymSearchQuery] = useState("")
    const [antonymSearchResults, setAntonymSearchResults] = useState<SimpleMeaning[]>([])
    const [isSearchingAntonym, setIsSearchingAntonym] = useState(false)

    const activeWord = words.find((w) => w.id === selectedWordId) || null
    const [attachedAntonyms, setAttachedAntonyms] = useState<SimpleMeaning[]>([])

    useEffect(() => {
        if (!rootSearchQuery.trim()) {
            setRootSearchResults([])
            return
        }
        const delayDebounce = setTimeout(async () => {
            setIsSearchingRoot(true)
            try {
                const res = await fetch(`/api/meanings/search?query=${encodeURIComponent(rootSearchQuery)}`)
                if (res.ok) {
                    const data = await res.json()
                    setRootSearchResults(data)
                }
            } catch (e) {
                console.error(e)
            } finally {
                setIsSearchingRoot(false)
            }
        }, 300)
        return () => clearTimeout(delayDebounce)
    }, [rootSearchQuery])

    useEffect(() => {
        if (!antonymSearchQuery.trim()) {
            setAntonymSearchResults([])
            return
        }
        const delayDebounce = setTimeout(async () => {
            setIsSearchingAntonym(true)
            try {
                const res = await fetch(`/api/meanings/search?query=${encodeURIComponent(antonymSearchQuery)}`)
                if (res.ok) {
                    const data = await res.json()
                    setAntonymSearchResults(data.filter((m: SimpleMeaning) => m.id !== selectedMeaningId))
                }
            } catch (e) {
                console.error(e)
            } finally {
                setIsSearchingAntonym(false)
            }
        }, 300)
        return () => clearTimeout(delayDebounce)
    }, [antonymSearchQuery, selectedMeaningId])

    useEffect(() => {
        setAttachedAntonyms([])
        setAntonymSearchQuery("")
        setAntonymSearchResults([])

        if (activeWord && activeWord.meanings.length > 0) {
            const currentStillValid = activeWord.meanings.some(m => m.id === selectedMeaningId)
            if (!currentStillValid) {
                setSelectedMeaningId(activeWord.meanings[0].id)
            }
        } else {
            setSelectedMeaningId(null)
        }
    }, [selectedWordId, activeWord])

    useEffect(() => {
        if (selectedMeaningId && activeWord) {
            const meaning = activeWord.meanings.find(m => m.id === selectedMeaningId)
            if (meaning) {
                const existing: SimpleMeaning[] = meaning.antonymsSource
                    .map((a) => a.target)
                    .filter((t): t is TargetMeaning => !!t)
                    .map(toSimpleMeaning)
                setAttachedAntonyms(existing)
            } else {
                setAttachedAntonyms([])
            }
        } else {
            setAttachedAntonyms([])
        }
        setAntonymSearchQuery("")
        setAntonymSearchResults([])
    }, [selectedMeaningId, activeWord])

    const handleSelectRootFromSearch = (meaning: SimpleMeaning) => {
        const wordId = meaning.word.id
        const alreadyInList = words.some((w) => w.id === wordId)

        if (!alreadyInList) {
            const newWord: WordItem = {
                id: wordId,
                value: meaning.word.value,
                meanings: [{
                    id: meaning.id,
                    meaning: meaning.meaning,
                    antonymsSource: []
                }]
            }
            setWords([newWord, ...words])
        }

        setSelectedWordId(wordId)
        setSelectedMeaningId(meaning.id)
        setRootSearchQuery("")
        setRootSearchResults([])
    }

    const handleToggleAntonym = (meaning: SimpleMeaning) => {
        const isAttached = attachedAntonyms.some((a) => a.id === meaning.id)
        if (isAttached) {
            setAttachedAntonyms(attachedAntonyms.filter((a) => a.id !== meaning.id))
        } else {
            setAttachedAntonyms([...attachedAntonyms, meaning])
        }
    }

    const handleSave = () => {
        if (!selectedMeaningId) return
        startTransition(async () => {
            try {
                const ids = attachedAntonyms.map((a) => a.id)
                await onUpdateAntonyms(selectedMeaningId, ids)

                setWords(prev => prev.map(w => {
                    if (w.id !== selectedWordId) return w
                    return {
                        ...w,
                        meanings: w.meanings.map(m => {
                            if (m.id !== selectedMeaningId) return m
                            return {
                                ...m,
                                antonymsSource: attachedAntonyms.map(a => ({
                                    id: 0,
                                    proximity: 1,
                                    target: toTargetMeaning(a)
                                }))
                            }
                        })
                    }
                }))
                alert("Связи антонимов успешно обновлены!")
            } catch (e) {
                alert("Ошибка при сохранении")
            }
        })
    }

    const meaningDisplay = (m: SimpleMeaning): string => {
        const word = m.word.value || `ID: ${m.word.id}`
        return m.meaning ? `${word} — ${m.meaning}` : word
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start h-full overflow-hidden pb-6">

            <div className="lg:col-span-4 bg-transparent h-full overflow-y-auto space-y-3 pr-2 flex flex-col min-h-0">
                <div className="space-y-1 px-1">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Найти слово с нуля</label>
                        {isSearchingRoot && <span className="text-[10px] text-muted-foreground animate-pulse">Ищу...</span>}
                    </div>
                    <input
                        type="text"
                        value={rootSearchQuery}
                        onChange={(e) => setRootSearchQuery(e.target.value)}
                        placeholder="Введите слово для связывания..."
                        className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary outline-none shadow-sm"
                    />
                    {rootSearchQuery.trim() && rootSearchResults.length > 0 && (
                        <div className="border rounded-lg p-1 bg-background shadow-md max-h-[200px] overflow-y-auto absolute z-20 w-full left-0 mt-1 space-y-0.5">
                            {rootSearchResults.map((r) => (
                                <div
                                    key={`root-res-${r.id}`}
                                    onClick={() => handleSelectRootFromSearch(r)}
                                    className="p-2 text-xs hover:bg-primary/10 rounded cursor-pointer transition-colors flex justify-between"
                                >
                                    <span className="font-medium">{meaningDisplay(r)}</span>
                                    <span className="text-[10px] text-muted-foreground">выбрать</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">
                        Выбранные слова ({words.length})
                    </div>
                    {words.map((w) => {
                        const isCurrent = w.id === selectedWordId
                        const totalAnt = w.meanings.reduce((sum, m) => sum + m.antonymsSource.length, 0)
                        return (
                            <div
                                key={w.id}
                                onClick={() => setSelectedWordId(w.id)}
                                className={`p-3 flex items-center justify-between cursor-pointer rounded-lg border transition-all ${
                                    isCurrent ? "bg-primary/10 border-primary shadow-sm" : "bg-transparent border-transparent hover:bg-muted/40"
                                }`}
                            >
                                <span className="font-medium text-sm truncate">{w.value || `ID: ${w.id}`}</span>
                                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${
                                    totalAnt > 0 ? "bg-red-500/5 text-red-600 border-red-500/20" : "bg-muted text-muted-foreground"
                                }`}>
                                  {totalAnt} ант.
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="lg:col-span-8 border rounded-xl bg-background p-6 shadow-sm h-full overflow-y-auto flex flex-col">
                {activeWord ? (
                    <div className="space-y-5 flex-1 flex flex-col">
                        <div className="border-b pb-3">
                            <h2 className="text-base font-bold">
                                Антонимы для: <span className="text-red-600">{activeWord.value}</span>
                            </h2>
                            <p className="text-xs text-muted-foreground">ID слова: {activeWord.id}</p>

                            {activeWord.meanings.length > 1 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    <span className="text-[11px] text-muted-foreground mr-1 self-center">Значение:</span>
                                    {activeWord.meanings.map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => setSelectedMeaningId(m.id)}
                                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                                m.id === selectedMeaningId
                                                    ? "bg-red-500/10 border-red-500 text-red-600 font-semibold"
                                                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                                            }`}
                                        >
                                            {m.meaning || `Значение #${m.id}`}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeWord.meanings.length === 1 && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                    Значение: <span className="font-semibold text-foreground">{activeWord.meanings[0].meaning || `Значение #${activeWord.meanings[0].id}`}</span>
                                </div>
                            )}
                        </div>

                        {selectedMeaningId && activeWord.meanings.some(m => m.id === selectedMeaningId) ? (
                            <>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        Текущие антонимы значения
                                    </label>
                                    <div className="p-3 border border-dashed rounded-lg bg-muted/10 flex flex-wrap gap-1.5 min-h-[50px] max-h-[120px] overflow-y-auto">
                                        {attachedAntonyms.length > 0 ? (
                                            attachedAntonyms.map((ant) => (
                                                <span
                                                    key={`att-${ant.id}`}
                                                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-red-500/5 text-red-600 border border-red-500/20"
                                                >
                                                    {meaningDisplay(ant)}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleAntonym(ant)}
                                                        className="ml-1.5 text-red-600 hover:text-destructive font-bold"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic p-1">
                                                Список антонимов пуст. Используйте поиск ниже, чтобы добавить противоположные по смыслу значения.
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 flex-1 flex flex-col min-h-0">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            Искать и добавить антоним
                                        </label>
                                        {isSearchingAntonym && (
                                            <span className="text-[11px] text-muted-foreground animate-pulse">
                                                Поиск по базе...
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={antonymSearchQuery}
                                        onChange={(e) => setAntonymSearchQuery(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent focus:ring-1 focus:ring-primary outline-none"
                                        placeholder="Начните вводить противоположное слово..."
                                    />

                                    {antonymSearchQuery.trim() && (
                                        <div className="border rounded-lg overflow-y-auto flex-1 max-h-[200px] p-2 space-y-1 bg-muted/20">
                                            {antonymSearchResults.length > 0 ? (
                                                antonymSearchResults.map((res) => {
                                                    const isSelected = attachedAntonyms.some((a) => a.id === res.id)
                                                    return (
                                                        <div
                                                            key={`res-${res.id}`}
                                                            onClick={() => handleToggleAntonym(res)}
                                                            className={`p-2 rounded-md text-xs font-medium flex justify-between items-center cursor-pointer transition-colors ${
                                                                isSelected
                                                                    ? "bg-red-500/5 text-red-600 border-red-500/30"
                                                                    : "hover:bg-muted bg-background border"
                                                            }`}
                                                        >
                                                            <span>{meaningDisplay(res)}</span>
                                                            <span className="text-[11px] font-bold">
                                                                {isSelected ? "✓ Выбрано" : "+ Добавить"}
                                                            </span>
                                                        </div>
                                                    )
                                                })
                                            ) : (
                                                !isSearchingAntonym && (
                                                    <p className="text-xs text-muted-foreground p-4 text-center">
                                                        Значения не найдены
                                                    </p>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={handleSave}
                                        disabled={isPending}
                                        className="px-4 py-2 bg-primary text-primary-foreground font-medium text-xs rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                                    >
                                        {isPending ? "Сохранение..." : "Сохранить связи"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-12">
                                Выберите значение слова для управления антонимами
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-12">
                        Выберите слово или найдите его через поиск слева, чтобы завести связи с нуля
                    </div>
                )}
            </div>
        </div>
    )
}