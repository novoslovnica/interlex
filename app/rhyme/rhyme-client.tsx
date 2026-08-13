"use client"

import { useState, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"

interface RhymeEntry {
  id: number
  value: string
  ipa: string
}

interface RhymeSearchResult {
  queryIpa: string
  queryKey: string
  exact: RhymeEntry[]
  similar: (RhymeEntry & { distance: number })[]
}

export default function RhymeClient() {
  const t = useTranslations("rhyme")
  const searchParams = useSearchParams()
  const [word, setWord] = useState(searchParams.get("word") || "")
  const [result, setResult] = useState<RhymeSearchResult | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) return
    setStatus("loading")
    try {
      const res = await fetch(`/api/lexicon/rhyme?word=${encodeURIComponent(query.trim())}`)
      if (!res.ok) throw new Error("request failed")
      const data = await res.json()
      setResult(data)
      setStatus("idle")
    } catch {
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    const initial = searchParams.get("word")
    if (initial) runSearch(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(word)
  }

  return (
    <div className="min-h-full py-10 bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0f172a] dark:text-slate-100">
      <div className="max-w-2xl mx-auto px-4 md:px-6 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder={t("placeholder")}
            className="flex-1 px-3 py-2 text-sm rounded border bg-background"
          />
          <button
            type="submit"
            disabled={status === "loading" || !word.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
          >
            {status === "loading" ? t("searching") : t("search")}
          </button>
        </form>

        {status === "error" && <p className="text-sm text-red-500">{t("error")}</p>}

        {result && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              {t("computedIpa")} <span className="font-mono text-base text-foreground">{result.queryIpa}</span>
            </p>

            <section className="space-y-2">
              <h2 className="text-base font-bold">{t("exactRhymes")} ({result.exact.length})</h2>
              {result.exact.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noExact")}</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {result.exact.map((entry) => (
                    <li key={entry.id}>
                      <Link
                        href={`/words/${entry.id}`}
                        target="_blank"
                        className="inline-block px-3 py-1.5 bg-background border rounded-lg text-sm hover:border-primary transition-colors"
                        title={entry.ipa}
                      >
                        {entry.value}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold">{t("similarSounding")} ({result.similar.length})</h2>
              {result.similar.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noSimilar")}</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {result.similar.map((entry) => (
                    <li key={entry.id}>
                      <Link
                        href={`/words/${entry.id}`}
                        target="_blank"
                        className="inline-block px-3 py-1.5 bg-background border rounded-lg text-sm hover:border-primary transition-colors"
                        title={entry.ipa}
                      >
                        {entry.value}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
