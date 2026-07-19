"use client"

import React, { useState, useEffect, useCallback } from "react"

interface RootOption {
  id: number
  value: string | null
}

interface WordItem {
  id: number
  value: string
  allophones: string[]
  meaning: string | null
  isLinked: boolean
  lexemeMorphemeId: number | null
}

const ROOT_SEARCH_DEBOUNCE = 400
const WORD_SEARCH_DEBOUNCE = 400

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function WordsClient() {
  const [rootQuery, setRootQuery] = useState("")
  const [rootResults, setRootResults] = useState<RootOption[]>([])
  const [selectedRoot, setSelectedRoot] = useState<RootOption | null>(null)
  const [rootDropdownOpen, setRootDropdownOpen] = useState(false)
  const [wordQuery, setWordQuery] = useState("")
  const [words, setWords] = useState<WordItem[]>([])
  const [loadingWords, setLoadingWords] = useState(false)
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set())

  const debouncedRootQuery = useDebounce(rootQuery, ROOT_SEARCH_DEBOUNCE)
  const debouncedWordQuery = useDebounce(wordQuery, WORD_SEARCH_DEBOUNCE)

  useEffect(() => {
    if (!debouncedRootQuery.trim()) {
      setRootResults([])
      return
    }
    const controller = new AbortController()
    fetch(`/api/roots?query=${encodeURIComponent(debouncedRootQuery)}&limit=20&admin=true`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        const items = data.items ?? data ?? []
        setRootResults(Array.isArray(items) ? items : [])
      })
      .catch(() => {})
    return () => controller.abort()
  }, [debouncedRootQuery])

  useEffect(() => {
    if (!selectedRoot || !debouncedWordQuery.trim()) {
      setWords([])
      return
    }
    setLoadingWords(true)
    const controller = new AbortController()
    fetch(`/api/roots/${selectedRoot.id}/words/search?query=${encodeURIComponent(debouncedWordQuery)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        setWords(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => setLoadingWords(false))
    return () => controller.abort()
  }, [selectedRoot, debouncedWordQuery])

  const handleRootSelect = useCallback((root: RootOption) => {
    setSelectedRoot(root)
    setRootQuery(root.value ?? "")
    setRootDropdownOpen(false)
    setWordQuery(root.value ?? "")
  }, [])

  const toggleWord = useCallback(async (word: WordItem) => {
    if (!selectedRoot) return
    setTogglingIds((prev) => new Set(prev).add(word.id))
    try {
      if (word.isLinked && word.lexemeMorphemeId) {
        const res = await fetch(`/api/roots/${selectedRoot.id}/words`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rootWordId: word.lexemeMorphemeId }),
        })
        if (res.ok) {
          setWords((prev) =>
            prev.map((w) =>
              w.id === word.id ? { ...w, isLinked: false, lexemeMorphemeId: null } : w
            )
          )
        }
      } else {
        const res = await fetch(`/api/roots/${selectedRoot.id}/words`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wordId: word.id }),
        })
        if (res.ok) {
          const created = await res.json()
          setWords((prev) =>
            prev.map((w) =>
              w.id === word.id ? { ...w, isLinked: true, lexemeMorphemeId: created.id } : w
            )
          )
        }
      }
    } catch {
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(word.id)
        return next
      })
    }
  }, [selectedRoot])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 text-sm text-foreground flex-1 overflow-y-auto min-h-0">
      <div className="border-b pb-4 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Слова корня</h1>
        <p className="text-xs text-muted-foreground">
          Массовое добавление и удаление слов, привязанных к корню.
        </p>
      </div>

      <div className="flex flex-col gap-4 bg-muted/20 p-4 rounded-xl border shrink-0">
        <div className="relative">
          <label className="block text-xs font-semibold mb-1">Корень</label>
          <input
            type="text"
            placeholder="Поиск корня..."
            className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={rootQuery}
            onChange={(e) => {
              setRootQuery(e.target.value)
              setRootDropdownOpen(true)
              if (!e.target.value) setSelectedRoot(null)
            }}
            onFocus={() => setRootDropdownOpen(true)}
          />
          {rootDropdownOpen && rootResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 border rounded-md bg-background shadow-lg max-h-48 overflow-y-auto">
              {rootResults.map((root) => (
                <button
                  key={root.id}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/20 transition-colors ${
                    selectedRoot?.id === root.id ? "bg-muted/30 font-semibold" : ""
                  }`}
                  onClick={() => handleRootSelect(root)}
                >
                  {root.value || "—"}
                  <span className="text-muted-foreground ml-2">ID: {root.id}</span>
                </button>
              ))}
            </div>
          )}
          {selectedRoot && (
            <span className="text-xs text-muted-foreground mt-1 block">
              Выбран корень: <strong>{selectedRoot.value}</strong> (ID: {selectedRoot.id})
            </span>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">
            Поиск лексем
            {selectedRoot && (
              <span className="text-muted-foreground font-normal ml-1">
                (автозаполнено от значения корня)
              </span>
            )}
          </label>
          <input
            type="text"
            placeholder="Поиск по value или аллофонам..."
            className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={wordQuery}
            onChange={(e) => setWordQuery(e.target.value)}
            disabled={!selectedRoot}
          />
        </div>
      </div>

      <div className="border rounded-xl bg-background shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="overflow-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted text-xs font-semibold uppercase border-b sticky top-0">
                <th className="p-3 w-12 text-center">Связь</th>
                <th className="p-3">ID</th>
                <th className="p-3">Value</th>
                <th className="p-3">Аллофоны</th>
                <th className="p-3">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {words.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {loadingWords
                      ? "Загрузка..."
                      : !selectedRoot
                        ? "Выберите корень"
                        : !debouncedWordQuery.trim()
                          ? "Введите поисковый запрос"
                          : "Нет результатов"}
                  </td>
                </tr>
              ) : (
                words.map((word) => (
                  <tr
                    key={word.id}
                    className={`hover:bg-muted/10 transition-colors ${
                      word.isLinked ? "bg-green-500/5" : ""
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={word.isLinked}
                        disabled={togglingIds.has(word.id)}
                        onChange={() => toggleWord(word)}
                        className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{word.id}</td>
                    <td className="p-3 font-semibold">{word.value}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {word.allophones.length > 0
                          ? word.allophones.map((a, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 bg-muted rounded text-xs"
                              >
                                {a}
                              </span>
                            ))
                          : "—"}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
                      {word.meaning || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}