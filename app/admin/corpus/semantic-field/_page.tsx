"use client"

import { useEffect, useState } from "react"

interface WordOption {
  id: number
  slug: string
  value: string | null
  isv: string | null
}

interface CollocateResult {
  slug: string
  value: string | null
  f1: number
  f2: number
  f12: number
  dice: number
  pmi: number | null
  logLikelihood: number
  classification: "core" | "periphery"
  existingRelations: string[]
}

interface CollocationAnalysis {
  targetSlug: string
  targetValue: string | null
  window: number
  totalCorpusTokens: number
  targetFrequency: number
  collocates: CollocateResult[]
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function formatNumber(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return "—"
  return n.toFixed(digits)
}

export default function SemanticFieldPage() {
  const [wordQuery, setWordQuery] = useState("")
  const debouncedWordQuery = useDebounce(wordQuery, 400)
  const [wordOptions, setWordOptions] = useState<WordOption[]>([])
  const [selectedWord, setSelectedWord] = useState<WordOption | null>(null)
  const [window_, setWindow] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<CollocationAnalysis | null>(null)

  useEffect(() => {
    if (!debouncedWordQuery.trim() || selectedWord) return
    let cancelled = false
    fetch(`/api/words/search?query=${encodeURIComponent(debouncedWordQuery)}`)
      .then((res) => res.json())
      .then((data: WordOption[]) => {
        if (!cancelled) setWordOptions(data)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedWordQuery, selectedWord])

  const visibleWordOptions = !selectedWord && debouncedWordQuery.trim() ? wordOptions : []

  function selectWord(word: WordOption) {
    setSelectedWord(word)
    setWordQuery(word.value || word.slug)
    setWordOptions([])
    setAnalysis(null)
    setError(null)
  }

  function clearSelection() {
    setSelectedWord(null)
    setWordQuery("")
    setAnalysis(null)
    setError(null)
  }

  async function runAnalysis() {
    if (!selectedWord) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/corpus/semantic-field?slug=${encodeURIComponent(selectedWord.slug)}&window=${window_}`,
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Ошибка запроса")
        setAnalysis(null)
      } else {
        setAnalysis(data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-2">Семантическое поле: ядро и периферия</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Для выбранного слова показывает его коллокаты в корпусе — слова, совместная встречаемость
        которых с целевым статистически значима (Log-Likelihood). Ядро — сильные коллокаты
        (LL ≥ 15.13), периферия — слабее, но ещё значимые (LL ≥ 10.83). Dice и PMI показаны как
        вспомогательные метрики.
      </p>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="relative w-72">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Слово</label>
          <input
            type="text"
            value={wordQuery}
            onChange={(e) => {
              setWordQuery(e.target.value)
              setSelectedWord(null)
            }}
            placeholder="Начните вводить слово..."
            className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
          />
          {selectedWord && (
            <button
              onClick={clearSelection}
              className="absolute right-2 top-8 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
          {visibleWordOptions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border bg-background shadow-lg max-h-64 overflow-y-auto">
              {visibleWordOptions.map((w) => (
                <button
                  key={w.id}
                  onClick={() => selectWord(w)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                >
                  {w.isv || w.value} <span className="text-xs text-muted-foreground">({w.slug})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Окно (± токенов)</label>
          <input
            type="number"
            min={1}
            max={20}
            value={window_}
            onChange={(e) => setWindow(Number(e.target.value) || 5)}
            className="w-24 px-3 py-2 text-sm rounded-lg border bg-background"
          />
        </div>

        <button
          onClick={runAnalysis}
          disabled={!selectedWord || loading}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? "Вычисление..." : "Найти коллокаты"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {analysis && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            <strong className="text-foreground">{analysis.targetValue || analysis.targetSlug}</strong>
            {" — частота в корпусе: "}
            {analysis.targetFrequency}
            {" из "}
            {analysis.totalCorpusTokens}
            {" токенов, окно ±"}
            {analysis.window}
          </div>

          {analysis.collocates.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border rounded-lg">
              Значимых коллокатов не найдено (слово либо не встречается в корпусе, либо совместная
              встречаемость с другими словами статистически незначима).
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Слово</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Dice</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">PMI</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Log-Likelihood</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Класс</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Уже связано</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.collocates.map((c) => (
                    <tr key={c.slug} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {c.value || c.slug}
                        <span className="ml-2 text-xs text-muted-foreground">({c.slug})</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(c.dice, 3)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(c.pmi)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(c.logLikelihood, 1)}</td>
                      <td className="px-4 py-3">
                        {c.classification === "core" ? (
                          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                            Ядро
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
                            Периферия
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.existingRelations.length > 0 ? c.existingRelations.join(", ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
