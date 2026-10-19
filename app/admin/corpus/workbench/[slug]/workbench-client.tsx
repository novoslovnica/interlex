"use client"

import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { QueueFilter, QueueToken, TokenDetail, TokenEdit, WorkbenchCandidate } from "@/lib/corpus/workbench"
import { positionOf, readWorkspace, samePosition, shortcut, type Position, type SavedWorkspace } from "@/lib/corpus/workbenchClientState"
import { cyrillicToLatin, latinToCyrillic } from "@/lib/orthography/standard"

type Draft = { kind: "candidate"; candidateId: number } | { kind: "manual"; wordSlug: string; value: string; feats: string }
interface SearchWord { slug: string; value: string | null; pos: string | null }
interface QueuePage { tokens: QueueToken[]; more: boolean }
const control = "rounded border border-current/20 bg-transparent px-3 py-2 disabled:opacity-40"
const primary = "rounded border border-blue-600 bg-blue-600 px-3 py-2 text-white disabled:opacity-40"
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`)
  return data as T
}
const message = (e: unknown) => e instanceof Error ? e.message : "Не удалось выполнить действие"
function featText(raw: string | null) {
  try { return Object.entries(JSON.parse(raw || "{}") as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(" · ") || "Граммемы не заданы" } catch { return raw || "Граммемы не заданы" }
}
function GrammarFields({ raw, onChange }: { raw: string; onChange: (value: string) => void }) {
  let feats: Record<string, string> = {}
  let valid = true
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.values(parsed).some((v) => typeof v !== "string")) valid = false
    else feats = parsed as Record<string, string>
  } catch { valid = false }
  const fields = [
    { key: "case", label: "Падеж", options: [["nom", "Именительный"], ["gen", "Родительный"], ["dat", "Дательный"], ["acc", "Винительный"], ["ins", "Творительный"], ["loc", "Местный"], ["voc", "Звательный"]] },
    { key: "number", label: "Число", options: [["sg", "Единственное"], ["du", "Двойственное"], ["pl", "Множественное"]] },
    { key: "gender", label: "Род", options: [["Masc", "Мужской"], ["Fem", "Женский"], ["Neut", "Средний"]] },
  ]
  return <div className="space-y-2">
    {valid && fields.map((field) => <label key={field.key} className="block text-sm">{field.label}<select className={`${control} mt-1 w-full`} value={feats[field.key] || ""} onChange={(e) => {
      const next = { ...feats }; if (e.target.value) next[field.key] = e.target.value; else delete next[field.key]
      onChange(JSON.stringify(next, null, 2))
    }}><option value="">Не задан</option>{feats[field.key] && !field.options.some(([value]) => value === feats[field.key]) && <option value={feats[field.key]}>{feats[field.key]}</option>}{field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}
    <details open={!valid ? true : undefined}><summary className="cursor-pointer text-sm underline">Все граммемы / дополнительные признаки</summary><label className="mt-2 block text-sm">Граммемы (JSON)<textarea aria-label="Граммемы JSON" rows={5} className={`${control} mt-1 w-full font-mono text-xs`} value={raw} onChange={(e) => onChange(e.target.value)} /></label><p className="text-xs opacity-60">Объект строк, например: {`{"case":"nom","number":"sg"}`}. Остальные признаки сохраняются при изменении полей выше.</p></details>
    <p className="text-xs opacity-60">Незаполненные признаки не считаются установленными.</p>
  </div>
}
export default function WorkbenchClient({ slug, title, userKey }: { slug: string; title: string; userKey: string }) {
  const api = `/api/admin/corpus/workbench/${encodeURIComponent(slug)}`
  const storageKey = `corpus-workbench:v1:${encodeURIComponent(userKey)}:${encodeURIComponent(slug)}`
  const [detail, setDetail] = useState<TokenDetail | null>(null)
  const [queue, setQueue] = useState<QueuePage>({ tokens: [], more: false })
  const [filter, setFilter] = useState<QueueFilter>("problems")
  const [query, setQuery] = useState("")
  const [queryInput, setQueryInput] = useState("")
  const [draft, setDraft] = useState<Draft | null>(null)
  const [deferred, setDeferred] = useState<Position[]>([])
  const [showDeferred, setShowDeferred] = useState(false)
  const [script, setScript] = useState<SavedWorkspace["script"]>("original")
  const [expanded, setExpanded] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [edits, setEdits] = useState<TokenEdit[]>([])
  const [historyMore, setHistoryMore] = useState(false)
  const [search, setSearch] = useState("")
  const [words, setWords] = useState<SearchWord[]>([])
  const [searchError, setSearchError] = useState("")
  const mounted = useRef(false)
  const pending = useRef(false)
  const sequence = useRef(0)
  const dirty = draft !== null
  const current = useRef({ detail, draft, filter, query, deferred, script })
  useLayoutEffect(() => { current.current = { detail, draft, filter, query, deferred, script } })
  const display = (text: string) => script === "original" ? text : script === "latin" ? cyrillicToLatin(text) : latinToCyrillic(cyrillicToLatin(text))
  const candidates = detail?.candidates.slice().sort((a, b) => a.rank - b.rank || a.id - b.id) || []
  const confirmDiscard = useCallback(() => !current.current.draft || window.confirm("Есть несохранённый выбор. Перейти и сбросить его?"), [])
  const getQueue = useCallback((f: QueueFilter, q: string, cursor?: string, direction = "after") => request<QueuePage>(`${api}?${new URLSearchParams({ filter: f, q, ...(cursor ? { cursor, direction } : {}) })}`), [api])
  const history = useCallback(async (before?: string) => {
    const page = await request<{ edits: TokenEdit[]; more: boolean }>(`${api}?${new URLSearchParams({ view: "history", ...(before ? { before } : {}) })}`)
    setEdits((prev) => before ? [...prev, ...page.edits] : page.edits)
    setHistoryMore(page.more)
  }, [api])
  const load = useCallback(async (id: string, f: QueueFilter, q: string, expected?: Position) => {
    const seq = ++sequence.current
    setLoading(true)
    setError("")
    try {
      const [next, page] = await Promise.all([request<TokenDetail>(`${api}?token=${id}`), getQueue(f, q, id, "from")])
      if (seq !== sequence.current || !mounted.current) return false
      if (expected && !samePosition(expected, next.token)) {
        setError("Документ переразмечен: сохранённая позиция больше не соответствует токену. Откройте вхождение из очереди.")
        setQueue(page)
        return false
      }
      setDetail(next)
      setQueue(page)
      setDraft(null)
      setWords([])
      setSearch("")
      const url = new URL(window.location.href)
      url.search = new URLSearchParams({ token: id, filter: f, ...(q ? { q } : {}) }).toString()
      window.history.replaceState(null, "", url)
      return true
    } catch (e) { if (seq === sequence.current && mounted.current) setError(message(e)); return false }
    finally { if (seq === sequence.current && mounted.current) setLoading(false) }
  }, [api, getQueue])
  useEffect(() => {
    mounted.current = true
    let cancelled = false
    sequence.current++
    void (async () => {
      // Restore browser-owned state after hydration, never during server render.
      await Promise.resolve()
      if (cancelled) return
      let saved = readWorkspace(null)
      try { saved = readWorkspace(localStorage.getItem(storageKey)) } catch { /* storage may be disabled */ }
      const url = new URL(window.location.href)
      const f = url.searchParams.get("filter")
      const initialFilter = f === "all" || f === "manual" || f === "problems" ? f : saved.filter
      const q = (url.searchParams.get("q") || "").slice(0, 120)
      const explicit = url.searchParams.get("token")
      const id = explicit || saved.position?.id
      setFilter(initialFilter); setQuery(q); setQueryInput(q); setDeferred(saved.deferred); setScript(saved.script)
      if (id && /^[1-9]\d{0,18}$/.test(id)) {
        const ok = await load(id, initialFilter, q, explicit ? undefined : saved.position)
        if (ok || cancelled) return
      }
      try {
        const page = await getQueue(initialFilter, q)
        if (cancelled) return
        setQueue(page)
        if (!id && page.tokens[0]) await load(page.tokens[0].id, initialFilter, q)
      } catch (e) { if (!cancelled) setError(message(e)) }
      finally { if (!cancelled) setLoading(false) }
    })()
    queueMicrotask(() => { if (!cancelled) void history().catch((e: unknown) => { if (!cancelled) setError(message(e)) }) })
    return () => { cancelled = true; mounted.current = false }
  }, [getQueue, history, load, storageKey])
  useEffect(() => {
    if (loading) return
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, ...(detail ? { position: positionOf(detail.token) } : {}), deferred, filter, script })) }
    catch { queueMicrotask(() => { if (mounted.current) setNotice("Браузер не разрешает сохранить позицию. Используйте ссылку на текущий токен.") }) }
  }, [detail, deferred, filter, loading, script, storageKey])
  useEffect(() => {
    if (!dirty && !busy) return
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    const click = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target.closest("a") : null
      if (target && !target.hasAttribute("download") && target.target !== "_blank" && (pending.current || !confirmDiscard())) { e.preventDefault(); e.stopPropagation() }
    }
    window.addEventListener("beforeunload", beforeUnload)
    document.addEventListener("click", click, true)
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", click, true) }
  }, [busy, confirmDiscard, dirty])
  useEffect(() => {
    if (search.trim().length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void request<SearchWord[]>(`/api/lexicon?${new URLSearchParams({ search: search.trim(), limit: "8" })}`, { signal: controller.signal })
        .then((rows) => setWords(rows.filter((r, i) => rows.findIndex((p) => p.slug === r.slug) === i)))
        .catch((e: unknown) => { if (!controller.signal.aborted) setSearchError(message(e)) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search])
  const selectToken = async (id: string, expected?: Position) => {
    if (pending.current || loading || !confirmDiscard()) return
    setNotice("")
    await load(id, filter, query, expected)
  }
  const next = async (direction: "after" | "before", bypassDirty = false, deferredOverride?: Position[]) => {
    const c = current.current
    if (!c.detail || (pending.current && !bypassDirty) || (!bypassDirty && !confirmDiscard())) return
    setLoading(true)
    try {
      let cursor = c.detail.token.id
      const skipped = deferredOverride || c.deferred
      // The local deferred list is bounded to 500; no unbounded automatic scan.
      for (let n = 0; n < 12; n++) {
        const page = await getQueue(c.filter, c.query, cursor, direction)
        const target = page.tokens.find((t) => !skipped.some((d) => samePosition(d, t)))
        if (target) { await load(target.id, c.filter, c.query); return }
        if (!page.more || !page.tokens.length) { setNotice(direction === "after" ? "Достигнут конец очереди. Отложенные вхождения доступны отдельно." : "Это начало очереди."); return }
        cursor = page.tokens.at(-1)!.id
      }
      setNotice("Не найдено следующего вхождения. Откройте список отложенных.")
    } catch (e) { setError(message(e)) }
    finally { setLoading(false) }
  }
  const save = async (advance: boolean) => {
    const c = current.current
    if (pending.current || loading || !c.detail || !c.draft) return
    let selection: { candidateId: number } | { wordSlug: string; feats: Record<string, string> }
    try {
      if (c.draft.kind === "candidate") selection = { candidateId: c.draft.candidateId }
      else {
        const feats: unknown = JSON.parse(c.draft.feats)
        if (!feats || typeof feats !== "object" || Array.isArray(feats) || Object.values(feats).some((v) => typeof v !== "string")) throw new Error("Граммемы должны быть JSON-объектом со строковыми значениями")
        selection = { wordSlug: c.draft.wordSlug, feats: feats as Record<string, string> }
      }
    } catch (e) { setError(message(e)); return }
    pending.current = true; setBusy(true); setError(""); setNotice("")
    try {
      await request(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokenId: c.detail.token.id, revision: c.detail.revision, ...selection }) })
      // The write succeeded: never allow a second submission of its old revision.
      setDraft(null)
      current.current.draft = null
      const remaining = c.deferred.filter((d) => !samePosition(d, c.detail!.token))
      setDeferred(remaining)
      setNotice("Разбор сохранён. Правка добавлена в журнал.")
      await load(c.detail.token.id, c.filter, c.query)
      if (advance) await next("after", true, remaining)
      await history().catch((e: unknown) => setError(`Правка сохранена, но журнал не загрузился: ${message(e)}`))
    } catch (e) { setError(message(e)) }
    finally { pending.current = false; setBusy(false) }
  }
  const defer = async () => {
    const c = current.current
    if (!c.detail || pending.current || loading || !confirmDiscard()) return
    const position = positionOf(c.detail.token)
    if (c.deferred.length >= 500 && !c.deferred.some((d) => samePosition(d, position))) { setError("Отложено 500 вхождений. Разберите часть списка, прежде чем добавлять новые."); return }
    const items = [...c.deferred.filter((d) => !samePosition(d, position)), position]
    setDeferred(items)
    setDraft(null)
    current.current.draft = null
    await next("after", true, items)
  }
  const undo = async (edit: TokenEdit) => {
    if (pending.current || loading || !confirmDiscard() || !window.confirm(`Отменить правку «${edit.surfaceForm}»? Откат возможен только без последующих изменений.`)) return
    pending.current = true; setBusy(true); setError("")
    try {
      await request(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "undo", editId: edit.id }) })
      setNotice("Правка отменена, прежний разбор восстановлен.")
      await load(edit.tokenId, filter, query)
    } catch (e) { setError(message(e)) }
    finally { await history().catch((e: unknown) => setError(message(e))); pending.current = false; setBusy(false) }
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const el = event.target
      const editing = el instanceof HTMLElement && (!!el.closest("input, textarea, select, button, [contenteditable='true']"))
      if (event.repeat || event.isComposing || busy || loading) return
      const action = shortcut(event, editing)
      if (action === null) return
      if (typeof action === "number") {
        if (!candidates[action]) return
        event.preventDefault(); setDraft({ kind: "candidate", candidateId: candidates[action].id }); return
      }
      event.preventDefault()
      if (action === "save" || action === "saveNext") void save(action === "saveNext")
      else if (action === "defer") void defer()
      else void next(action === "previous" ? "before" : "after")
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  })
  const changeFilter = async (f: QueueFilter, q: string) => {
    if (pending.current || loading || !confirmDiscard()) return
    setLoading(true); setError("")
    try {
      const page = await getQueue(f, q)
      setFilter(f); setQuery(q); setQueue(page); setShowDeferred(false)
      setDraft(null)
      if (page.tokens[0]) await load(page.tokens[0].id, f, q)
      else {
        setDetail(null)
        const url = new URL(window.location.href); url.search = new URLSearchParams({ filter: f, ...(q ? { q } : {}) }).toString(); window.history.replaceState(null, "", url)
      }
    } catch (e) { setError(message(e)) }
    finally { setLoading(false) }
  }
  const pageQueue = async (direction: "before" | "after") => {
    if (busy || loading || !queue.tokens.length) return
    const cursor = direction === "after" ? queue.tokens.at(-1)!.id : queue.tokens[0].id
    setLoading(true)
    try {
      const page = await getQueue(filter, query, cursor, direction)
      if (!page.tokens.length) { setNotice("Больше вхождений в этом направлении нет."); return }
      if (direction === "before") page.tokens.reverse()
      setQueue(page)
    } catch (e) { setError(message(e)) }
    finally { setLoading(false) }
  }
  const choose = (c: WorkbenchCandidate) => setDraft({ kind: "candidate", candidateId: c.id })
  // The app shell already consumes space for the global/admin headers and
  // disables body scrolling. Size columns from the remaining flex space,
  // rather than subtracting guessed header heights from the viewport.
  return <main className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col gap-3 overflow-y-auto p-3 md:p-5 lg:overflow-hidden">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <div><Link href="/admin/corpus/workbench" className="text-sm underline">← Документы</Link><h1 className="text-xl font-bold">{title}</h1><p className="text-sm opacity-70">Рабочее место редактора · {dirty ? "Есть несохранённый выбор" : "Выберите вхождение и проверьте разбор"}</p></div>
      <label className="text-sm">Письмо <select aria-label="Письмо" value={script} onChange={(e) => setScript(e.target.value as SavedWorkspace["script"])} className={control}><option value="original">Как в тексте</option><option value="latin">Латиница</option><option value="cyrillic">Кириллица</option></select></label>
    </header>
    <div aria-live="polite" className="max-h-[25dvh] min-h-6 shrink-0 overflow-y-auto">{error && <p role="alert" className="rounded border border-red-500 p-2 text-red-600 dark:text-red-400">{error} {detail && <button disabled={busy || loading} className="underline" onClick={() => { if (confirmDiscard()) void load(detail.token.id, filter, query) }}>Загрузить свежую версию</button>}</p>}{notice && <p className="text-sm">{notice}</p>}{loading && <p className="text-sm opacity-70">Загрузка…</p>}</div>
    <div className="grid shrink-0 items-start gap-3 lg:min-h-0 lg:flex-1 lg:shrink lg:items-stretch lg:overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)_360px] xl:grid-cols-[260px_minmax(0,1fr)_400px]">
      <aside aria-label="Очередь вхождений" className="min-h-0 max-h-96 space-y-3 overflow-y-auto rounded border border-current/20 p-3 lg:h-full lg:max-h-none lg:overscroll-contain">
        <h2 className="font-semibold">Очередь вхождений</h2>
        <select aria-label="Фильтр очереди" value={filter} disabled={busy || loading} className={`${control} w-full`} onChange={(e) => void changeFilter(e.target.value as QueueFilter, query)}><option value="problems">Требуют разбора</option><option value="all">Все слова</option><option value="manual">Размечены вручную</option></select>
        <form onSubmit={(e) => { e.preventDefault(); void changeFilter(filter, queryInput.trim()) }} className="flex gap-1"><input aria-label="Поиск словоформы" placeholder="Словоформа" value={queryInput} maxLength={120} onChange={(e) => setQueryInput(e.target.value)} className={`${control} min-w-0 w-full`} /><button className={control} disabled={busy || loading}>↵</button></form>
        <button aria-pressed={showDeferred} onClick={() => setShowDeferred(!showDeferred)} className={`${control} w-full`}>{showDeferred ? "Вернуться к очереди" : `Отложенные (${deferred.length})`}</button>
        {showDeferred ? <ul className="space-y-1">{deferred.map((d) => <li key={d.id} className="flex gap-1"><button disabled={busy || loading} onClick={() => void selectToken(d.id, d)} className={`${control} min-w-0 flex-1 text-left`}>{display(d.surfaceForm)} <span className="text-xs opacity-60">#{d.tokenIndex}</span></button><button aria-label={`Убрать ${d.surfaceForm} из отложенных`} className={control} onClick={() => setDeferred(deferred.filter((p) => p.id !== d.id))}>×</button></li>)}</ul> : <>
          <ul className="space-y-1">{queue.tokens.map((t) => <li key={t.id}><button disabled={busy || loading} aria-current={detail?.token.id === t.id ? "true" : undefined} onClick={() => void selectToken(t.id)} className={`${control} w-full text-left ${detail?.token.id === t.id ? "ring-2 ring-blue-500" : ""}`}><span className="font-medium">{display(t.surfaceForm)}</span> <span className="text-xs opacity-60">#{t.tokenIndex}</span><span className="block truncate text-xs opacity-70">{t.resolutionSource === "manual" ? "Ручной разбор" : t.matchCount === 0 ? "Не распознано" : t.isPartialMatch ? "Частичное совпадение" : `Авто · ${t.matchCount} разборов`}{deferred.some((d) => samePosition(d, t)) ? " · Отложено" : ""}</span></button></li>)}</ul>
          {!queue.tokens.length && <p className="text-sm">Вхождений по этому фильтру нет.</p>}
          <div className="flex justify-between gap-1"><button disabled={busy || loading || !queue.tokens.length} className={control} onClick={() => void pageQueue("before")}>← 50</button><button disabled={busy || loading || !queue.tokens.length} className={control} onClick={() => void pageQueue("after")}>50 →</button></div>
        </>}
      </aside>
      <section aria-label="Контекст" className="min-w-0 space-y-4 rounded border border-current/20 p-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Контекст</h2><div className="flex gap-2"><button className={control} disabled={busy || loading || !detail} onClick={() => void next("before")}>← Назад</button><button className={control} disabled={busy || loading || !detail} onClick={() => void next("after")}>Дальше →</button></div></div>
        {detail ? <>
          <p className="text-xs opacity-60">Токен #{detail.token.tokenIndex} · {detail.token.resolutionSource === "manual" ? "Разобран вручную" : "Автоматический разбор; требует проверки"}</p>
          <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">{detail.highlight ? <>{display(detail.highlight.before)}<mark className="rounded bg-amber-200 px-1 text-black">{display(detail.highlight.word)}</mark>{display(detail.highlight.after)}</> : display(detail.sentence.rawText)}</p>
          {!detail.highlight && <p className="text-sm opacity-70">Точная позиция в предложении не определена. Выбрано: {display(detail.token.surfaceForm)}.</p>}
          <button aria-expanded={expanded} className="text-sm underline" onClick={() => setExpanded(!expanded)}>{expanded ? "Свернуть расширенный контекст" : "Показать абзац и соседние абзацы"}</button>
          {expanded && <div className="space-y-4 border-t border-current/15 pt-3 text-sm leading-relaxed">{detail.context.map((p) => <div key={p.id} className={p.id === detail.sentence.segmentId ? "border-l-2 border-blue-500 pl-3" : "opacity-70"}><span className="text-xs opacity-60">Абзац {p.position + 1}{p.id === detail.sentence.segmentId ? " · текущий" : ""}</span><p className="whitespace-pre-wrap break-words">{display(p.rawText)}{p.rawText.length >= 16000 && "… (показано начало абзаца)"}</p></div>)}</div>}
        </> : <p>Выберите вхождение в очереди.</p>}
        <details className="border-t border-current/15 pt-3 text-sm"><summary className="cursor-pointer">Горячие клавиши</summary><p className="mt-2">← / K — назад; → / J — дальше; 1–9 — выбрать разбор; D — отложить; Ctrl / ⌘ + S — сохранить; Ctrl / ⌘ + Enter — сохранить и дальше. Навигация и выбор цифрами не работают при вводе текста.</p></details>
        <details className="border-t border-current/15 pt-3" open>
          <summary className="cursor-pointer font-semibold">Журнал точечных правок</summary><p className="my-2 text-xs opacity-70">Откат доступен, пока токен, его кандидаты и контекст не менялись. Старые пакетные правки остаются в прежнем журнале.</p>
          <ul className="space-y-2">{edits.map((e) => <li key={e.id} className="rounded border border-current/15 p-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span>{display(e.surfaceForm)} → {display(e.wordSlug || "—")}</span><button disabled={busy || loading || e.state !== "active"} className={control} onClick={() => void undo(e)}>{e.state === "undone" ? "Отменено" : e.state === "conflict" ? "Откат заблокирован" : "Откатить"}</button></div><p className="text-xs opacity-60">{new Date(e.createdAt).toLocaleString("ru-RU")} · {e.userEmail || "Редактор"}</p></li>)}</ul>
          {!edits.length && <p className="text-sm opacity-70">В этом документе ещё нет правок из нового рабочего места.</p>}
          {historyMore && <button className={`${control} mt-2`} disabled={busy || loading} onClick={() => void history(edits.at(-1)?.id).catch((e: unknown) => setError(message(e)))}>Ещё записи</button>}
        </details>
      </section>
      <aside aria-label="Панель токена" className="min-w-0 space-y-3 rounded border border-current/20 p-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
        <h2 className="text-xl font-semibold">{detail ? display(detail.token.surfaceForm) : "Панель токена"}</h2>
        {detail ? <fieldset disabled={busy || loading} className="space-y-3">
          <legend className="mb-2 text-sm">Текущий разбор: {display(detail.token.lemma)} · {detail.token.pos}</legend><p className="text-xs opacity-70">{featText(detail.token.feats)}</p>
          <p className="text-sm">Выберите лексему и граммемы для этого вхождения. Совпадение с грамматическим движком само по себе не означает проверку редактором.</p>
          {candidates.map((c, index) => <div key={c.id} className={`rounded border p-3 ${draft?.kind === "candidate" && draft.candidateId === c.id ? "border-blue-500 ring-1 ring-blue-500" : "border-current/20"}`}><label className="block cursor-pointer"><span className="flex gap-2"><input type="radio" name="candidate" checked={draft?.kind === "candidate" && draft.candidateId === c.id} onChange={() => choose(c)} /><span>{index < 9 && <span className="mr-1 text-xs opacity-50">{index + 1}.</span>}<strong>{display(c.lemma)}</strong> · {c.pos}</span></span><span className="mt-1 block text-xs">{featText(c.feats)}</span><span className="mt-1 block truncate text-xs opacity-60">{c.flavor || "CORE"} · {c.source}</span></label><div className="mt-1 flex flex-wrap gap-3"><Link target="_blank" rel="noopener noreferrer" className="text-xs underline" href={`/words/${encodeURIComponent(c.wordSlug)}`}>Открыть лексему ↗</Link>{draft?.kind === "candidate" && draft.candidateId === c.id && <button type="button" className="text-xs underline" onClick={() => setDraft({ kind: "manual", wordSlug: c.wordSlug, value: c.lemma, feats: c.feats || "{}" })}>Уточнить граммемы</button>}</div></div>)}
          {!candidates.length && <p className="text-sm">Разборов нет. Найдите лексему в словаре.</p>}
          <details open={draft?.kind === "manual" ? true : undefined} className="border-t border-current/15 pt-3"><summary className="cursor-pointer text-sm">Выбрать другую лексему / изменить граммемы</summary>
            {detail.token.wordSlug && <button type="button" className={`${control} my-2 text-sm`} onClick={() => setDraft({ kind: "manual", wordSlug: detail.token.wordSlug!, value: detail.token.lemma, feats: JSON.stringify(JSON.parse(detail.token.feats || "{}"), null, 2) })}>Изменить текущий разбор</button>}
            <input aria-label="Поиск лексемы в словаре" className={`${control} my-2 w-full`} placeholder="Поиск в словаре (от 2 букв)" value={search} maxLength={120} onChange={(e) => { setSearch(e.target.value); setWords([]); setSearchError("") }} />
            {searchError && <p className="text-sm text-red-600">{searchError}</p>}
            {words.map((w) => <button type="button" className={`${control} mb-1 w-full text-left text-sm`} key={w.slug} onClick={() => setDraft({ kind: "manual", wordSlug: w.slug, value: w.value || w.slug, feats: "{}" })}>{display(w.value || w.slug)} · {w.pos}</button>)}
            {draft?.kind === "manual" && <div className="space-y-2"><p className="break-words text-sm">Лексема: {display(draft.value)}</p><GrammarFields raw={draft.feats} onChange={(feats) => setDraft({ ...draft, feats })} /></div>}
          </details>
          <div className="sticky bottom-0 space-y-2 rounded border border-current/20 bg-[var(--background)] p-2">
            <button className={`${primary} w-full`} disabled={!draft} onClick={() => void save(true)}>{busy ? "Сохранение…" : "Сохранить и дальше"}</button>
            <div className="flex gap-2"><button className={`${control} flex-1`} disabled={!draft} onClick={() => void save(false)}>Сохранить</button><button className={`${control} flex-1`} onClick={() => void defer()}>Отложить</button></div>
            {draft && <button className="text-xs underline" onClick={() => setDraft(null)}>Сбросить несохранённый выбор</button>}
          </div>
        </fieldset> : <p className="text-sm opacity-70">Панель остаётся на месте при навигации. Здесь появятся лексема и варианты разбора.</p>}
      </aside>
    </div>
  </main>
}
