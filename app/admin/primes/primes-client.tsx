"use client"

import { useState, useTransition, useEffect } from "react"
import type { PrimeItem } from "./page"

interface SimpleMeaning {
  id: number
  meaning: string | null
  word: {
    id: number
    value: string | null
  }
}

interface PrimesClientProps {
  initialPrimes: PrimeItem[]
  onUpdateExponents: (primeCode: string, meaningIds: number[]) => Promise<void>
}

export function PrimesClient({ initialPrimes, onUpdateExponents }: PrimesClientProps) {
  const [primes, setPrimes] = useState<PrimeItem[]>(initialPrimes)
  const [selectedCode, setSelectedCode] = useState<string | null>(initialPrimes[0]?.code || null)
  const [isPending, startTransition] = useTransition()

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SimpleMeaning[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const activePrime = primes.find((p) => p.code === selectedCode) || null
  const [attachedExponents, setAttachedExponents] = useState<SimpleMeaning[]>([])

  const categories = Array.from(new Set(primes.map((p) => p.category || "Без категории")))

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/meanings/search?query=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => clearTimeout(delayDebounce)
  }, [searchQuery])

  useEffect(() => {
    if (activePrime) {
      setAttachedExponents(activePrime.exponents.map((e) => e.meaning))
    } else {
      setAttachedExponents([])
    }
    setSearchQuery("")
    setSearchResults([])
  }, [selectedCode, activePrime])

  const handleToggleExponent = (meaning: SimpleMeaning) => {
    const isAttached = attachedExponents.some((m) => m.id === meaning.id)
    if (isAttached) {
      setAttachedExponents(attachedExponents.filter((m) => m.id !== meaning.id))
    } else {
      setAttachedExponents([...attachedExponents, meaning])
    }
  }

  const handleSave = () => {
    if (!selectedCode) return
    startTransition(async () => {
      try {
        const ids = attachedExponents.map((m) => m.id)
        await onUpdateExponents(selectedCode, ids)

        setPrimes((prev) =>
          prev.map((p) => {
            if (p.code !== selectedCode) return p
            return {
              ...p,
              exponents: attachedExponents.map((m) => ({ id: 0, isCanonical: true, note: null, meaning: m })),
            }
          })
        )
        alert("Экспоненты прайма обновлены!")
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
      <div className="lg:col-span-4 bg-transparent h-full overflow-y-auto space-y-4 pr-2 flex flex-col min-h-0">
        {categories.map((category) => (
          <div key={category} className="space-y-1">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">
              {category}
            </div>
            {primes
              .filter((p) => (p.category || "Без категории") === category)
              .map((p) => {
                const isCurrent = p.code === selectedCode
                return (
                  <div
                    key={p.code}
                    onClick={() => setSelectedCode(p.code)}
                    className={`p-2.5 flex items-center justify-between cursor-pointer rounded-lg border transition-all ${
                      isCurrent ? "bg-primary/10 border-primary shadow-sm" : "bg-transparent border-transparent hover:bg-muted/40"
                    }`}
                  >
                    <span className="font-medium text-sm truncate">{p.englishText}</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${
                        p.exponents.length > 0
                          ? "bg-blue-500/5 text-blue-600 border-blue-500/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.exponents.length} эксп.
                    </span>
                  </div>
                )
              })}
          </div>
        ))}
      </div>

      <div className="lg:col-span-8 border rounded-xl bg-background p-6 shadow-sm h-full overflow-y-auto flex flex-col">
        {activePrime ? (
          <div className="space-y-5 flex-1 flex flex-col">
            <div className="border-b pb-3">
              <h2 className="text-base font-bold">
                Экспоненты прайма: <span className="text-blue-600">{activePrime.englishText}</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Категория: {activePrime.category || "—"}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Текущие экспоненты
              </label>
              <div className="p-3 border border-dashed rounded-lg bg-muted/10 flex flex-wrap gap-1.5 min-h-[50px] max-h-[120px] overflow-y-auto">
                {attachedExponents.length > 0 ? (
                  attachedExponents.map((exp) => (
                    <span
                      key={`att-${exp.id}`}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-blue-500/5 text-blue-600 border border-blue-500/20"
                    >
                      {meaningDisplay(exp)}
                      <button
                        type="button"
                        onClick={() => handleToggleExponent(exp)}
                        className="ml-1.5 text-blue-600 hover:text-destructive font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic p-1">
                    Экспонент ещё не подобран. Найдите межславянское значение ниже.
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Искать значение
                </label>
                {isSearching && (
                  <span className="text-[11px] text-muted-foreground animate-pulse">Поиск по базе...</span>
                )}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent focus:ring-1 focus:ring-primary outline-none"
                placeholder="Начните вводить межславянское слово..."
              />

              {searchQuery.trim() && (
                <div className="border rounded-lg overflow-y-auto flex-1 max-h-[200px] p-2 space-y-1 bg-muted/20">
                  {searchResults.length > 0 ? (
                    searchResults.map((res) => {
                      const isSelected = attachedExponents.some((m) => m.id === res.id)
                      return (
                        <div
                          key={`res-${res.id}`}
                          onClick={() => handleToggleExponent(res)}
                          className={`p-2 rounded-md text-xs font-medium flex justify-between items-center cursor-pointer transition-colors ${
                            isSelected ? "bg-primary/10 text-primary border-primary/30" : "hover:bg-muted bg-background border"
                          }`}
                        >
                          <span>{meaningDisplay(res)}</span>
                          <span className="text-[11px] font-bold">{isSelected ? "✓ Выбрано" : "+ Добавить"}</span>
                        </div>
                      )
                    })
                  ) : (
                    !isSearching && (
                      <p className="text-xs text-muted-foreground p-4 text-center">Значения не найдены</p>
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
                {isPending ? "Сохранение..." : "Сохранить экспоненты"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-12">
            Выберите прайм слева, чтобы управлять его экспонентами
          </div>
        )}
      </div>
    </div>
  )
}
