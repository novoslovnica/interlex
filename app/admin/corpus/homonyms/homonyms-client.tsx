"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { HomonymGroupDetail, HomonymGroupListRow } from "@/lib/corpus/fetchHomonymGroups"
import type { ReviewBatch } from "@/lib/corpus/homonymReview"

interface Props {
  groups: HomonymGroupListRow[]; total: number; page: number; pageSize: number; search: string
  batches: ReviewBatch[]; batchPage: number; hasMoreBatches: boolean
}

function GroupCard({ group, onChanged }: { group: HomonymGroupListRow; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<HomonymGroupDetail | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async (after?: string) => {
    setBusy(true)
    setError(null)
    setSelected(new Set())
    // Hide stale contexts immediately; a failed refresh cannot leave them actionable.
    setDetail(null)
    try {
      const res = await fetch("/api/admin/corpus/homonyms/detail", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupKey: group.groupKey, after }),
      })
      if (!res.ok) throw new Error("Не удалось загрузить контексты")
      setDetail(await res.json() as HomonymGroupDetail)
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка запроса") }
    finally { setBusy(false) }
  }

  const apply = async (wordSlug: string) => {
    if (!detail || selected.size === 0) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch("/api/admin/corpus/homonyms/resolve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupKey: group.groupKey, wordSlug,
          tokens: detail.contexts.filter((t) => selected.has(t.tokenId)).map(({ tokenId, revision }) => ({ tokenId, revision })) }),
      })
      const data = await res.json() as { error?: string; resolvedTokens: number }
      if (!res.ok) {
        if (res.status === 409) { setDetail(null); setSelected(new Set()) }
        throw new Error(data.error ?? "Ошибка сохранения")
      }
      setNotice(`Сохранено вхождений: ${data.resolvedTokens}. Пакет доступен для отката в истории.`)
      setSelected(new Set())
      setDetail(null)
      onChanged()
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка запроса") }
    finally { setBusy(false) }
  }

  return (
    <section className="border rounded-xl bg-muted/10 overflow-hidden">
      <button type="button" aria-expanded={expanded} onClick={() => {
        setExpanded(!expanded)
        if (!expanded && !detail) void load()
      }} className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30">
        <span className="font-mono text-base">{group.form}</span>
        <span className="text-xs text-muted-foreground">{group.wordSlugs.length} лексем · {group.documentCount} док. · {group.tokenCount.toLocaleString("ru-RU")} вхождений {expanded ? "−" : "+"}</span>
      </button>
      {expanded && <div className="border-t bg-background p-4 space-y-3">
        <p className="text-xs text-muted-foreground">Прочитайте предложение каждого вхождения и отметьте только те, где верна выбранная лексема. Одинаковая форма не гарантирует одинакового значения. Грамматические признаки останутся автоматическими: при необходимости проверьте их в документе.</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {notice && <p role="status" className="text-sm text-teal-700">{notice}</p>}
        {busy && <p role="status" className="text-xs">Загрузка…</p>}
        <button type="button" disabled={busy} onClick={() => void load()} className="text-xs underline disabled:opacity-40">Обновить контексты / в начало</button>
        {detail && <>
          {detail.contexts.length === 0 && <p className="text-sm">В этой группе не осталось неразрешённых вхождений.</p>}
          <div className="space-y-2">
            {detail.contexts.map((context) => <label key={context.tokenId} className="flex items-start gap-3 rounded border p-3 cursor-pointer">
              <input type="checkbox" checked={selected.has(context.tokenId)} disabled={busy} className="mt-1"
                onChange={(event) => {
                  const checked = event.target.checked
                  setSelected((prev) => { const next = new Set(prev); if (checked) next.add(context.tokenId); else next.delete(context.tokenId); return next })
                }} />
              <span className="min-w-0 space-y-1">
                <span className="block text-sm whitespace-pre-wrap break-words">{context.highlight ? <>{context.highlight.before}<mark className="bg-yellow-200 text-black rounded px-0.5">{context.highlight.word}</mark>{context.highlight.after}</> : context.sentence}</span>
                <span className="block text-xs text-muted-foreground">{context.documentTitle} · форма «{context.surfaceForm}» · позиция {context.tokenIndex} · ID {context.tokenId}</span>
                {!context.highlight && <span className="block text-xs text-amber-700">Не удалось выделить точное вхождение; проверьте позицию в документе.</span>}
              </span>
            </label>)}
          </div>
          {detail.nextCursor && <button type="button" disabled={busy} onClick={() => void load(detail.nextCursor!)} className="text-sm underline disabled:opacity-40">Следующие контексты (выбор будет сброшен) →</button>}
          <p className="text-sm font-medium">Выбрано вхождений: {selected.size}</p>
          <div className="space-y-2">
            {detail.candidates.map((candidate) => <div key={candidate.wordSlug} className="flex flex-wrap items-center justify-between gap-3 border rounded p-3">
              <Link href={`/words/${encodeURIComponent(candidate.wordSlug)}`} target="_blank" className="text-sm underline">
                {candidate.value ?? candidate.lemma} · {candidate.pos} · {candidate.wordSlug}
              </Link>
              <button type="button" disabled={busy || selected.size === 0} onClick={() => void apply(candidate.wordSlug)} className="px-3 py-2 text-xs rounded bg-teal-600 text-white disabled:opacity-40">
                Применить к выбранным ({selected.size})
              </button>
            </div>)}
          </div>
          <p className="text-xs text-muted-foreground">Если конкурирующие лексемы — дубли, используйте <Link href="/admin/deduplication" className="underline">дедупликацию</Link>.</p>
        </>}
      </div>}
    </section>
  )
}

export default function HomonymsClient({ groups, total, page, pageSize, search, batches, batchPage, hasMoreBatches }: Props) {
  const router = useRouter()
  const [busyBatch, setBusyBatch] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const undo = async (batchId: string) => {
    setBusyBatch(batchId)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/corpus/homonyms/batches", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId }),
      })
      const data = await res.json() as { error?: string; restored: number; conflicts: number }
      if (!res.ok) throw new Error(data.error ?? "Не удалось откатить пакет")
      setMessage(`Восстановлено: ${data.restored}. Конфликты: ${data.conflicts}; последующие правки сохранены.`)
      router.refresh()
    } catch (e) { setMessage(e instanceof Error ? e.message : "Ошибка запроса") }
    finally { setBusyBatch(null) }
  }
  const pageHref = (target: number) => {
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    if (target > 1) params.set("page", String(target))
    return `/admin/corpus/homonyms${params.size ? `?${params}` : ""}`
  }
  const historyHref = (target: number) => {
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    if (page > 1) params.set("page", String(page))
    params.set("batchPage", String(target))
    return `/admin/corpus/homonyms?${params}`
  }
  return <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6 space-y-4">
    <h1 className="text-xl font-bold">Омонимия корпуса: проверка контекстов</h1>
    <p className="text-sm text-muted-foreground max-w-3xl">Группы помогают найти неоднозначные вхождения. Решение применяется только к отмеченным контекстам, максимум 50 за пакет. Все отметки по умолчанию сняты.</p>
    <p className="text-xs">Групп: {total.toLocaleString("ru-RU")}</p>
    <details open={batchPage > 1 || undefined} className="border rounded-xl p-4">
      <summary className="cursor-pointer font-medium">История пакетов и откат</summary>
      <p className="text-xs text-muted-foreground my-3">История пакетов, по 20 на странице. Откат возвращает прежние разборы и порядок кандидатов. Изменённые позже вхождения пропускаются. Старые правки без журнала не имеют автоматического отката.</p>
      {message && <p role="status" className="text-sm my-2">{message}</p>}
      {batches.length === 0 && <p className="text-sm">Пакетов пока нет.</p>}
      {batches.map((batch) => <div key={batch.id} className="flex flex-wrap items-center justify-between gap-3 border-t py-3">
        <div className="text-xs break-all">
          <p>{batch.createdAt} · {batch.userEmail ?? batch.userId ?? "Автор неизвестен"}</p>
          <p>{batch.wordSlug} · всего {batch.total} · доступно к откату {batch.active} · восстановлено {batch.restored} · конфликтов {batch.conflicts}</p>
        </div>
        <button type="button" disabled={busyBatch !== null || batch.active === 0} onClick={() => void undo(batch.id)} className="text-xs border rounded px-3 py-2 disabled:opacity-40">
          {busyBatch === batch.id ? "Откат…" : "Откатить пакет"}
        </button>
      </div>)}
      <div className="flex gap-3 text-xs pt-3">
        {batchPage > 1 && <Link href={historyHref(batchPage - 1)}>← Более новые</Link>}
        <span>История: страница {batchPage}</span>
        {hasMoreBatches && <Link href={historyHref(batchPage + 1)}>Более старые →</Link>}
      </div>
    </details>
    <form action="/admin/corpus/homonyms" method="get" className="flex gap-2 max-w-md">
      <input type="text" name="q" defaultValue={search} aria-label="Начало словоформы" placeholder="Форма, напр. ne" className="min-w-0 flex-1 px-3 py-2 text-sm rounded border bg-background" />
      <button type="submit" className="px-3 py-2 text-sm rounded border">Найти</button>
    </form>
    {groups.length === 0 && <p className="text-sm">Неразрешённые группы не найдены.</p>}
    <div className="space-y-2">{groups.map((group) => <GroupCard key={group.groupKey} group={group} onChanged={() => router.refresh()} />)}</div>
    {totalPages > 1 && <div className="flex flex-wrap items-center gap-3 text-sm">
      {page > 1 && <Link href={pageHref(page - 1)}>← Назад</Link>}
      <span>Страница {page} из {totalPages}</span>
      {page < totalPages && <Link href={pageHref(page + 1)}>Вперёд →</Link>}
    </div>}
  </div>
}
