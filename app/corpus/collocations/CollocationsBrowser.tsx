"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { isvToCyr } from "@/lib/isv"
import { ScriptMode } from "@/lib/script-mode"

const PAGE_SIZE = 30

interface IdiomItem {
  id: number
  slug: string
  value: string | null
  pos: string | null
  corpusFrequency: number | null
}

interface NgramItem {
  id: number
  n: number
  slugs: string[]
  lemmas: string[]
  wordIds: (number | null)[]
  posPattern: string
  frequency: number
  score: number
  logLikelihood: number | null
}

interface NgramExample {
  sentenceId: string
  rawText: string
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function WordLink({ id, value, script }: { id: number | null; value: string; script: ScriptMode }) {
  const text = script === ScriptMode.CYRILLIC ? isvToCyr(value) : value.toLowerCase()
  if (id === null) return <span>{text}</span>
  return (
    <Link href={`/words/${id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
      {text}
    </Link>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )
}

export default function CollocationsBrowser({ currentScript }: { currentScript: ScriptMode }) {
  const t = useTranslations("corpus.collocations")
  const [script, setScript] = useState<ScriptMode>(currentScript)
  const [tab, setTab] = useState<"idioms" | "ngrams">("idioms")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 400)

  const [idiomItems, setIdiomItems] = useState<IdiomItem[]>([])
  const [idiomTotal, setIdiomTotal] = useState(0)
  const [idiomOffset, setIdiomOffset] = useState(0)
  const [idiomLoading, setIdiomLoading] = useState(false)

  const [n, setN] = useState(2)
  const [sort, setSort] = useState<"frequency" | "score">("frequency")
  const [ngramItems, setNgramItems] = useState<NgramItem[]>([])
  const [ngramTotal, setNgramTotal] = useState(0)
  const [ngramOffset, setNgramOffset] = useState(0)
  const [ngramLoading, setNgramLoading] = useState(false)

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [examplesById, setExamplesById] = useState<Record<number, NgramExample[] | "loading">>({})

  const fetchIdioms = useCallback(
    (offset: number, append: boolean) => {
      setIdiomLoading(true)
      const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) })
      if (debouncedSearch) params.set("search", debouncedSearch)
      fetch(`/api/corpus/collocations?${params}`)
        .then((r) => r.json())
        .then((data) => {
          setIdiomItems((prev) => (append ? [...prev, ...data.items] : data.items))
          setIdiomTotal(data.total)
          setIdiomOffset(offset)
        })
        .finally(() => setIdiomLoading(false))
    },
    [debouncedSearch],
  )

  const fetchNgrams = useCallback(
    (offset: number, append: boolean) => {
      setNgramLoading(true)
      const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE), n: String(n), sort })
      if (debouncedSearch) params.set("search", debouncedSearch)
      fetch(`/api/corpus/ngrams?${params}`)
        .then((r) => r.json())
        .then((data) => {
          setNgramItems((prev) => (append ? [...prev, ...data.items] : data.items))
          setNgramTotal(data.total)
          setNgramOffset(offset)
        })
        .finally(() => setNgramLoading(false))
    },
    [debouncedSearch, n, sort],
  )

  useEffect(() => {
    if (tab === "idioms") fetchIdioms(0, false)
  }, [tab, fetchIdioms])

  useEffect(() => {
    if (tab === "ngrams") {
      setExpandedId(null)
      fetchNgrams(0, false)
    }
  }, [tab, fetchNgrams])

  const toggleExamples = useCallback(
    (id: number) => {
      if (expandedId === id) {
        setExpandedId(null)
        return
      }
      setExpandedId(id)
      if (!examplesById[id]) {
        setExamplesById((prev) => ({ ...prev, [id]: "loading" }))
        fetch(`/api/corpus/ngrams/${id}/examples`)
          .then((r) => r.json())
          .then((data) => setExamplesById((prev) => ({ ...prev, [id]: data.examples ?? [] })))
          .catch(() => setExamplesById((prev) => ({ ...prev, [id]: [] })))
      }
    },
    [expandedId, examplesById],
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <button
          onClick={() => setScript((s) => (s === ScriptMode.CYRILLIC ? ScriptMode.LATIN : ScriptMode.CYRILLIC))}
          className="px-3 py-1.5 text-sm rounded-lg border hover:bg-muted/50 transition-colors shrink-0"
        >
          {script === ScriptMode.CYRILLIC ? "Кир" : "Lat"}
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{t("description")}</p>

      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setTab("idioms")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "idioms" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("tabIdioms")}
        </button>
        <button
          onClick={() => setTab("ngrams")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "ngrams" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("tabNgrams")}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg border bg-background"
        />
        {tab === "ngrams" && (
          <>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("sizeLabel")}</label>
              <select
                value={n}
                onChange={(e) => setN(Number(e.target.value))}
                className="px-3 py-2 text-sm rounded-lg border bg-background"
              >
                {[2, 3, 4, 5].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("sortLabel")}</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "frequency" | "score")}
                className="px-3 py-2 text-sm rounded-lg border bg-background"
              >
                <option value="frequency">{t("sortByFrequency")}</option>
                <option value="score">{t("sortByScore")}</option>
              </select>
            </div>
          </>
        )}
      </div>

      {tab === "idioms" && (
        <>
          <div className="text-xs text-muted-foreground mb-2">{t("totalCount", { count: idiomTotal })}</div>
          {idiomLoading && idiomItems.length === 0 ? (
            <Spinner />
          ) : idiomItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border rounded-lg">{t("noResults")}</div>
          ) : (
            <div className="rounded-lg border divide-y">
              {idiomItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <WordLink id={item.id} value={item.value || item.slug} script={script} />
                    {item.pos && <span className="ml-2 text-xs text-muted-foreground">{item.pos}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums" title={t("frequencyLabel")}>
                    {item.corpusFrequency ?? 0}
                  </div>
                </div>
              ))}
            </div>
          )}
          {idiomItems.length > 0 && idiomOffset + idiomItems.length < idiomTotal && (
            <div className="flex justify-center py-6">
              <button
                onClick={() => fetchIdioms(idiomOffset + PAGE_SIZE, true)}
                disabled={idiomLoading}
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-all shadow-sm text-sm disabled:opacity-50"
              >
                {t("loadMore")}
              </button>
            </div>
          )}
        </>
      )}

      {tab === "ngrams" && (
        <>
          <div className="text-xs text-muted-foreground mb-2">{t("totalCount", { count: ngramTotal })}</div>
          {ngramLoading && ngramItems.length === 0 ? (
            <Spinner />
          ) : ngramItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border rounded-lg">{t("noResults")}</div>
          ) : (
            <div className="rounded-lg border divide-y">
              {ngramItems.map((item) => (
                <div key={item.id}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
                      {item.lemmas.map((lemma, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-muted-foreground">·</span>}
                          <WordLink id={item.wordIds[i]} value={lemma} script={script} />
                        </span>
                      ))}
                      <span className="ml-2 text-xs text-muted-foreground">{item.posPattern.split("_").join(" · ")}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-xs text-muted-foreground tabular-nums text-right">
                        <div title={t("frequencyLabel")}>{item.frequency}</div>
                        <div title={t("scoreLabel")}>{(sort === "score" ? item.score : item.logLikelihood ?? item.score).toFixed(1)}</div>
                      </div>
                      <button onClick={() => toggleExamples(item.id)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0">
                        {expandedId === item.id ? t("hideExamples") : t("showExamples")}
                      </button>
                    </div>
                  </div>
                  {expandedId === item.id && (
                    <div className="px-4 pb-3 text-sm text-muted-foreground space-y-1">
                      {examplesById[item.id] === "loading" || !examplesById[item.id] ? (
                        <div>{t("loadingExamples")}</div>
                      ) : (examplesById[item.id] as NgramExample[]).length === 0 ? (
                        <div>{t("noExamples")}</div>
                      ) : (
                        (examplesById[item.id] as NgramExample[]).map((ex) => (
                          <div key={ex.sentenceId} className="font-mono text-xs bg-muted/30 rounded px-2 py-1">
                            {ex.rawText}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {ngramItems.length > 0 && ngramOffset + ngramItems.length < ngramTotal && (
            <div className="flex justify-center py-6">
              <button
                onClick={() => fetchNgrams(ngramOffset + PAGE_SIZE, true)}
                disabled={ngramLoading}
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-all shadow-sm text-sm disabled:opacity-50"
              >
                {t("loadMore")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
