"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { normalizeFeatValue, type TokenResult } from "./CorpusTokenDisplay"

interface LexemeInfo {
  slug: string
  value: string | null
  pos: string | null
  gender: string | null
  aspect: string | null
  transitivity: string | null
  animacy: string | null
  degree: string | null
  pronType: string | null
  numType: string | null
  paradigm: string | null
  protoStemClass: string | null
  stemExtension: string | null
  stem: string | null
  secondaryStem: string | null
  frequency: string | null
  intelligibility: string | null
  etymology: string | null
  proto: string | null
  corpusFrequency: number | null
  corpusFrequencyPerMln: number | null
  corpusRank: number | null
  corpusHapax: boolean | null
}

interface CandidateItem {
  id: number
  wordSlug: string
  lemma: string
  pos: string
  feats: Record<string, string>
  flavor: string | null
  score: number
  source: string
  rank: number
}

interface LexemeSearchResult {
  slug: string
  value: string | null
  pos: string | null
}

const FEAT_LABELS: Record<string, string> = {
  nom: "Именительный", gen: "Родительный", dat: "Дательный", acc: "Винительный",
  ins: "Творительный", loc: "Местный", voc: "Звательный",
  sg: "Единственное", du: "Двойственное", pl: "Множественное",
  masc: "Мужской", fem: "Женский", neut: "Средний",
  anim: "Одушевлённый", inanim: "Неодушевлённый",
  pres: "Настоящее", past: "Прошедшее", fut: "Будущее", aor: "Аорист", impf: "Имперфект",
  ind: "Изъявительное", imp: "Повелительное", sub: "Сослагательное",
  act: "Действительный", pass: "Страдательный",
  inf: "Инфинитив", fin: "Личная", part: "Причастие", ger: "Деепричастие",
  pos: "Положительная", comp: "Сравнительная", sup: "Превосходная",
  first: "1-е", second: "2-е", third: "3-е",
}

const FEAT_ORDER = [
  { key: "case", label: "Падеж" },
  { key: "number", label: "Число" },
  { key: "gender", label: "Род" },
  { key: "person", label: "Лицо" },
  { key: "tense", label: "Время" },
  { key: "mood", label: "Наклонение" },
  { key: "voice", label: "Залог" },
  { key: "verbForm", label: "Форма" },
  { key: "degree", label: "Степень" },
  { key: "animacy", label: "Одушевлённость" },
  { key: "aspect", label: "Вид" },
]

// Короткие коды — та же конвенция, что использует сам FEAT_LABELS выше и
// CASE_WEIGHTS/GrammaticalCase (lib/grammar/common/case.ts). Значения,
// сгенерированные грамматическим движком автоматически, на деле хранятся
// полным словом ('nominative') — нормализуется на отображении через
// normalizeFeatValue (см. CorpusTokenDisplay.tsx); ручной ввод сознательно
// использует "правильную" короткую конвенцию напрямую.
const CASE_OPTIONS = ["nom", "gen", "dat", "acc", "ins", "loc", "voc"]
const NUMBER_OPTIONS = ["sg", "du", "pl"]
const GENDER_OPTIONS = ["masc", "fem", "neut"]

export default function TokenSidebar({
  token,
  documentSlug = "",
  onClose,
  onResolved,
}: {
  token: TokenResult | null
  // Не передаётся из корпус-билдера (app/admin/corpus-builder) — там
  // документ ещё не сохранён, у токенов нет id, и весь код ниже, что
  // использует documentSlug, уже защищён проверкой token?.id.
  documentSlug?: string
  onClose: () => void
  onResolved?: () => void
}) {
  const [lexeme, setLexeme] = useState<LexemeInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [candidates, setCandidates] = useState<CandidateItem[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState<number | "manual" | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [resolveSuccess, setResolveSuccess] = useState(false)

  const [manualOpen, setManualOpen] = useState(false)
  const [manualQuery, setManualQuery] = useState("")
  const [manualResults, setManualResults] = useState<LexemeSearchResult[]>([])
  const [manualSearching, setManualSearching] = useState(false)
  const [manualSelected, setManualSelected] = useState<LexemeSearchResult | null>(null)
  const [manualCase, setManualCase] = useState("")
  const [manualNumber, setManualNumber] = useState("")
  const [manualGender, setManualGender] = useState("")

  const fetchLexeme = useCallback(async (slug: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/lexicon/by-slug/${slug}`)
      if (res.status === 404) throw new Error("Not found")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setLexeme(data)
    } catch (e) {
      const msg = e instanceof Error && e.message === "Not found"
        ? "Лексема не найдена в словаре"
        : "Не удалось загрузить данные о лексеме"
      setError(msg)
      setLexeme(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCandidates = useCallback(async (tokenId: string) => {
    setCandidatesLoading(true)
    try {
      const res = await fetch(`/api/admin/corpus/documents/${documentSlug}/tokens/${tokenId}/candidates`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setCandidates(data.candidates ?? [])
    } catch {
      setCandidates([])
    } finally {
      setCandidatesLoading(false)
    }
  }, [documentSlug])

  useEffect(() => {
    if (token?.wordSlug) {
      fetchLexeme(token.wordSlug)
    } else {
      setLexeme(null)
      setError(null)
      setLoading(false)
    }

    if (token?.id) {
      fetchCandidates(token.id)
    } else {
      setCandidates([])
    }

    setManualOpen(false)
    setManualQuery("")
    setManualResults([])
    setManualSelected(null)
    setManualCase("")
    setManualNumber("")
    setManualGender("")
    setResolveError(null)
    setResolveSuccess(false)
  }, [token, fetchLexeme, fetchCandidates])

  useEffect(() => {
    if (!manualOpen || manualQuery.trim().length < 2) {
      setManualResults([])
      return
    }
    const handle = setTimeout(async () => {
      setManualSearching(true)
      try {
        const res = await fetch(`/api/lexicon?search=${encodeURIComponent(manualQuery.trim())}&limit=8`)
        if (res.ok) {
          const data = await res.json()
          const items = Array.isArray(data) ? data : []
          setManualResults(items.map((r: { slug: string; value: string | null; pos: string | null }) => ({
            slug: r.slug, value: r.value, pos: r.pos,
          })))
        }
      } catch {
        setManualResults([])
      } finally {
        setManualSearching(false)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [manualQuery, manualOpen])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const afterResolveSuccess = useCallback(() => {
    setResolveSuccess(true)
    setTimeout(() => {
      onResolved?.()
      onClose()
    }, 700)
  }, [onResolved, onClose])

  const handleSelectCandidate = useCallback(async (candidateId: number) => {
    if (!token?.id) return
    setResolvingId(candidateId)
    setResolveError(null)
    try {
      const res = await fetch(`/api/admin/corpus/documents/${documentSlug}/tokens/${token.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Ошибка сохранения")
      afterResolveSuccess()
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : "Ошибка запроса")
    } finally {
      setResolvingId(null)
    }
  }, [token, documentSlug, afterResolveSuccess])

  const handleManualSubmit = useCallback(async () => {
    if (!token?.id || !manualSelected) return
    setResolvingId("manual")
    setResolveError(null)
    try {
      const feats: Record<string, string> = {}
      if (manualCase) feats.case = manualCase
      if (manualNumber) feats.number = manualNumber
      if (manualGender) feats.gender = manualGender

      const res = await fetch(`/api/admin/corpus/documents/${documentSlug}/tokens/${token.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordSlug: manualSelected.slug, feats }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Ошибка сохранения")
      afterResolveSuccess()
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : "Ошибка запроса")
    } finally {
      setResolvingId(null)
    }
  }, [token, documentSlug, manualSelected, manualCase, manualNumber, manualGender, afterResolveSuccess])

  if (!token) return null

  const hasHomonymy = token.matchCount > 1
  const isManuallyResolved = candidates.some((c) => c.source === "manual")

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed left-0 top-0 h-full w-[380px] bg-background border-r border-border shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-left duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
          <h2 className="text-sm font-semibold text-foreground">Информация о токене</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground">
              Поверхностная форма
            </div>
            <div className="px-3 py-2.5 font-mono text-base">{token.surfaceForm}</div>
          </div>

          {token.isPunctuation ? (
            <div className="rounded-lg border border-border p-3 text-muted-foreground text-xs">
              Знак пунктуации
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground">
                  Лемма / Словарная форма
                </div>
                <div className="px-3 py-2.5">
                  {token.wordSlug ? (
                    <Link
                      href={`/words/${token.wordSlug}`}
                      className="text-primary hover:underline font-mono"
                      target="_blank"
                    >
                      {token.lemma}
                    </Link>
                  ) : (
                    <span className="font-mono">{token.lemma}</span>
                  )}
                  {!token.isRecognized && (
                    <span className="ml-2 text-xs text-red-500">не найдено</span>
                  )}
                  {token.isPartialMatch && (
                    <span className="ml-2 text-xs text-yellow-500">основа найдена</span>
                  )}
                  {isManuallyResolved && (
                    <span className="ml-2 text-xs text-teal-600 dark:text-teal-400">разрешено вручную</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground">
                  Часть речи
                </div>
                <div className="px-3 py-2.5 font-mono">{token.pos}</div>
              </div>

              {token.isRecognized && Object.keys(token.feats).length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground">
                    Граммема
                  </div>
                  <div className="divide-y divide-border">
                    {FEAT_ORDER.map(({ key, label }) => {
                      const val = token.feats![key]
                      if (!val) return null
                      const displayVal = FEAT_LABELS[normalizeFeatValue(key, val)] ?? val
                      const displayKey =
                        key === "person" ? "Лицо" :
                        key === "verbForm" ? "Глагольная форма" :
                        key === "aspect" ? "Вид" : label
                      return (
                        <div key={key} className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">{displayKey}</span>
                          <span className="font-mono text-xs ml-2">{displayVal}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {hasHomonymy && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Неразрешённая омонимия — {token.matchCount} вариантов
                    </span>
                  </div>

                  {candidatesLoading ? (
                    <div className="px-3 pb-3 text-xs text-amber-600 dark:text-amber-400 animate-pulse">Загрузка кандидатов...</div>
                  ) : candidates.length === 0 ? (
                    <div className="px-3 pb-3 text-xs text-amber-600 dark:text-amber-400">Не удалось загрузить кандидатов</div>
                  ) : (
                    <div className="divide-y divide-amber-200 dark:divide-amber-800">
                      {candidates.map((c, idx) => {
                        const isCurrent = idx === 0
                        const featsStr = Object.entries(c.feats)
                          .map(([k, v]) => FEAT_LABELS[normalizeFeatValue(k, v)] ?? v)
                          .join(", ")
                        return (
                          <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs truncate">{c.lemma}</span>
                                <span className="text-[10px] text-muted-foreground">{c.pos}</span>
                                {isCurrent && (
                                  <span className="text-[10px] px-1 rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">текущий</span>
                                )}
                              </div>
                              {featsStr && <div className="text-[11px] text-muted-foreground truncate">{featsStr}</div>}
                            </div>
                            <button
                              onClick={() => handleSelectCandidate(c.id)}
                              disabled={resolvingId !== null || isCurrent}
                              className="shrink-0 px-2 py-1 text-[11px] font-medium rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                            >
                              {resolvingId === c.id ? "..." : isCurrent ? "выбран" : "Выбрать"}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {token.id && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setManualOpen((v) => !v)}
                    className="w-full px-3 py-2 bg-muted/30 text-xs font-medium text-muted-foreground text-left hover:bg-muted/50 transition-colors flex items-center justify-between"
                  >
                    <span>Указать вручную</span>
                    <span>{manualOpen ? "−" : "+"}</span>
                  </button>
                  {manualOpen && (
                    <div className="p-3 space-y-2">
                      <input
                        type="text"
                        value={manualQuery}
                        onChange={(e) => { setManualQuery(e.target.value); setManualSelected(null) }}
                        placeholder="Поиск лексемы..."
                        className="w-full px-2 py-1.5 text-xs rounded-md border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {manualSearching && <div className="text-[11px] text-muted-foreground">Поиск...</div>}
                      {!manualSelected && manualResults.length > 0 && (
                        <div className="border rounded-md divide-y divide-border max-h-40 overflow-y-auto">
                          {manualResults.map((r) => (
                            <button
                              key={r.slug}
                              onClick={() => { setManualSelected(r); setManualQuery(r.value ?? r.slug); setManualResults([]) }}
                              className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted/30 transition-colors flex items-center justify-between"
                            >
                              <span className="font-mono">{r.value ?? r.slug}</span>
                              <span className="text-[10px] text-muted-foreground">{r.pos}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {manualSelected && (
                        <div className="text-[11px] text-teal-600 dark:text-teal-400">
                          Выбрано: <span className="font-mono">{manualSelected.value ?? manualSelected.slug}</span> ({manualSelected.pos})
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-1.5">
                        <select
                          value={manualCase}
                          onChange={(e) => setManualCase(e.target.value)}
                          className="px-1.5 py-1 text-[11px] rounded-md border bg-background text-foreground"
                        >
                          <option value="">Падеж — </option>
                          {CASE_OPTIONS.map((v) => <option key={v} value={v}>{FEAT_LABELS[v]}</option>)}
                        </select>
                        <select
                          value={manualNumber}
                          onChange={(e) => setManualNumber(e.target.value)}
                          className="px-1.5 py-1 text-[11px] rounded-md border bg-background text-foreground"
                        >
                          <option value="">Число — </option>
                          {NUMBER_OPTIONS.map((v) => <option key={v} value={v}>{FEAT_LABELS[v]}</option>)}
                        </select>
                        <select
                          value={manualGender}
                          onChange={(e) => setManualGender(e.target.value)}
                          className="px-1.5 py-1 text-[11px] rounded-md border bg-background text-foreground"
                        >
                          <option value="">Род — </option>
                          {GENDER_OPTIONS.map((v) => <option key={v} value={v}>{FEAT_LABELS[v]}</option>)}
                        </select>
                      </div>

                      <button
                        onClick={handleManualSubmit}
                        disabled={!manualSelected || resolvingId !== null}
                        className="w-full px-2 py-1.5 text-xs font-medium rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                      >
                        {resolvingId === "manual" ? "Сохранение..." : "Сохранить"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {resolveError && (
                <div className="text-xs text-red-500 text-center py-1">{resolveError}</div>
              )}
              {resolveSuccess && (
                <div className="text-xs text-teal-600 dark:text-teal-400 text-center py-1">Сохранено</div>
              )}

              {token.isRecognized && lexeme && (
                <>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="px-3 py-2 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground">
                      Лексема
                    </div>
                    <div className="divide-y divide-border">
                      {lexeme.value && (
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Словарная форма</span>
                          <span className="font-mono text-xs">{lexeme.value}</span>
                        </div>
                      )}
                      {lexeme.gender && (
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Род</span>
                          <span className="font-mono text-xs">
                            {lexeme.gender === "masc" ? "Мужской" : lexeme.gender === "fem" ? "Женский" : lexeme.gender === "neut" ? "Средний" : lexeme.gender}
                          </span>
                        </div>
                      )}
                      {lexeme.aspect && (
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Вид</span>
                          <span className="font-mono text-xs">
                            {lexeme.aspect === "perf" ? "Совершенный" : lexeme.aspect === "impf" ? "Несовершенный" : lexeme.aspect}
                          </span>
                        </div>
                      )}
                      {lexeme.paradigm && (
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Парадигма</span>
                          <span className="font-mono text-xs">{lexeme.paradigm}</span>
                        </div>
                      )}
                      {lexeme.protoStemClass && (
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Класс основы</span>
                          <span className="font-mono text-xs">{lexeme.protoStemClass}</span>
                        </div>
                      )}
                      {lexeme.stem && (
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Основа</span>
                          <span className="font-mono text-xs">{lexeme.stem}</span>
                        </div>
                      )}
                      {lexeme.frequency && (
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Частотность</span>
                          <span className="font-mono text-xs">{lexeme.frequency}</span>
                        </div>
                      )}
                      {lexeme.intelligibility && (
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Понятность</span>
                          <span className="font-mono text-xs">{lexeme.intelligibility}</span>
                        </div>
                      )}
                      {lexeme.etymology && (
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Этимология</span>
                          <span className="font-mono text-xs text-right max-w-[200px] truncate" title={lexeme.etymology}>{lexeme.etymology}</span>
                        </div>
                      )}
                      {lexeme.proto && (
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Праславянская</span>
                          <span className="font-mono text-xs">{lexeme.proto}</span>
                        </div>
                      )}
                      {lexeme.corpusFrequency != null && (
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Част. в корпусе</span>
                          <span className="font-mono text-xs">
                            {lexeme.corpusFrequency}
                            {lexeme.corpusFrequencyPerMln != null && ` (${lexeme.corpusFrequencyPerMln}/млн)`}
                          </span>
                        </div>
                      )}
                      {lexeme.corpusRank != null && (
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Ранг</span>
                          <span className="font-mono text-xs">#{lexeme.corpusRank}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {lexeme.slug && (
                    <Link
                      href={`/words/${lexeme.slug}`}
                      target="_blank"
                      className="block w-full text-center px-3 py-2 rounded-lg border border-border text-xs text-primary hover:bg-muted/30 transition-colors"
                    >
                      Открыть страницу слова →
                    </Link>
                  )}
                </>
              )}

              {token.isRecognized && loading && (
                <div className="text-xs text-muted-foreground animate-pulse text-center py-4">
                  Загрузка данных...
                </div>
              )}

              {error && (
                <div className="text-xs text-red-500 text-center py-2">{error}</div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
