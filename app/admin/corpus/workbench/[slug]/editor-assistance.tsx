"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { Assistance, Recommendation } from "@/lib/corpus/workbenchAutomation"
import type { TokenDetail } from "@/lib/corpus/workbench"
import { normalizeSurfaceForm } from "@/lib/corpus/surfaceForm"
import { DEFER_REASONS, type DeferReason, type ReviewTask } from "@/lib/corpus/workbenchTaskTypes"

const button = "rounded border border-current/20 px-3 py-2 disabled:opacity-40"
export async function assistanceRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`)
  return data as T
}
interface TaskResponse { tasks: ReviewTask[]; currentTaskVersion: string | null; canPropose: boolean }
export function useEditorAssistance(api: string, detail: TokenDetail | null, owner: string) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [data, setData] = useState<{ api: string; owner: string; key: string; tasks: TaskResponse; assistance: Assistance | null } | null>(null)
  const [failure, setFailure] = useState<{ key: string; error: string } | null>(null)
  const [extra, setExtra] = useState<{ key: string; assistance: Assistance } | null>(null)
  const morePending = useRef(false)
  const key = `${owner}:${api}:${detail?.token.id || "none"}:${detail?.revision || ""}:${refreshKey}`
  const tokenId = detail?.token.id
  const revision = detail?.revision
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ view: "tasks", ...(tokenId ? { token: tokenId } : {}) })
    void Promise.all([
      assistanceRequest<TaskResponse>(`${api}/assistance?${params}`, { signal: controller.signal }),
      tokenId ? assistanceRequest<Assistance>(`${api}/assistance?token=${tokenId}`, { signal: controller.signal }) : Promise.resolve(null),
    ]).then(([tasks, assistance]) => {
      if (controller.signal.aborted) return
      if (assistance && assistance.tokenRevision !== revision) throw new Error("Разбор изменился. Загрузите свежую версию перед использованием подсказок.")
      setData({ api, owner, key, tasks, assistance })
    }).catch((e: unknown) => { if (!controller.signal.aborted) setFailure({ key, error: e instanceof Error ? e.message : "Подсказки недоступны" }) })
    return () => controller.abort()
  }, [api, key, owner, revision, tokenId])
  const refresh = useCallback(() => setRefreshKey((n) => n + 1), [])
  const current = data?.key === key ? data : null
  const page = extra?.key === key ? extra.assistance : current?.assistance
  const more = async () => {
    if (!page?.nextCursor || !tokenId || morePending.current) return
    morePending.current = true
    try {
      const next = await assistanceRequest<Assistance>(`${api}/assistance?${new URLSearchParams({ token: tokenId, cursor: page.nextCursor })}`)
      if (next.tokenRevision !== revision) throw new Error("Контекст изменился. Обновите подсказки.")
      setExtra({ key, assistance: { ...next, similar: [...page.similar, ...next.similar].slice(-100) } })
    } catch (e) { setFailure({ key, error: e instanceof Error ? e.message : "Не удалось загрузить вхождения" }) }
    finally { morePending.current = false }
  }
  return { ready: !!current, recommendation: current?.assistance?.recommendation || null,
    similar: page?.similar || [], hasMore: !!page?.nextCursor, more, refresh,
    tasks: data?.api === api && data.owner === owner ? data.tasks.tasks : [], taskVersion: current?.tasks.currentTaskVersion ?? null,
    canPropose: current?.tasks.canPropose || false, error: failure?.key === key ? failure.error : "" }
}
export function RecommendationCard({ recommendation, detail, display, disabled, onAccept }: {
  recommendation: Recommendation | null; detail: TokenDetail; display: (value: string) => string; disabled: boolean; onAccept: (r: Recommendation) => void
}) {
  if (!recommendation) return <p className="text-xs opacity-60">Однозначной подсказки нет — выберите разбор по контексту.</p>
  const candidate = detail.candidates.find((c) => c.id === recommendation.candidateId)
  if (!candidate) return null
  return <section aria-label="Рекомендованный разбор" className="space-y-2 rounded border border-blue-500/50 bg-blue-500/5 p-3">
    <h3 className="text-sm font-semibold">Рекомендация для этого вхождения</h3>
    <p className="text-sm">{display(candidate.lemma)} · {candidate.pos}</p><p className="break-words text-xs">{candidate.feats || "Граммемы не заданы"}</p>
    <ul className="list-disc space-y-1 pl-4 text-xs">{recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
    <button type="button" disabled={disabled} className={`${button} w-full`} onClick={() => onAccept(recommendation)}>Подтвердить рекомендацию и дальше</button>
  </section>
}
export function SimilarOccurrences({ entries, more, disabled, display, onMore, onOpen }: {
  entries: Assistance["similar"]; more: boolean; disabled: boolean; display: (v: string) => string; onMore: () => void; onOpen: (id: string) => void
}) {
  return <details className="border-t border-current/15 pt-3" open>
    <summary className="cursor-pointer font-semibold">Похожие вхождения в этом документе ({entries.length}{more ? "+" : ""})</summary>
    <p className="my-2 text-xs opacity-70">Совпадение формы и соседних слов помогает искать примеры, но не доказывает одинаковое значение. Каждое вхождение открывается и подтверждается отдельно.</p>
    <ul className="space-y-2">{entries.map((entry) => <li key={entry.id} className="space-y-2 rounded border border-current/15 p-2 text-sm">
      <p>{entry.highlight ? <>{display(entry.highlight.before)}<mark>{display(entry.highlight.word)}</mark>{display(entry.highlight.after)}</> : display(entry.sentence)}</p>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs opacity-60">#{entry.tokenIndex} · {entry.sameContext ? "Те же соседние слова" : "Та же словоформа"}</span><button type="button" disabled={disabled} className={button} onClick={() => onOpen(entry.id)}>Открыть вхождение</button></div>
    </li>)}</ul>
    {!entries.length && <p className="text-sm opacity-60">Других неразобранных вхождений этой формы не найдено.</p>}
    {more && <button type="button" disabled={disabled} className={`${button} mt-2`} onClick={onMore}>Ещё похожие</button>}
  </details>
}
export function TaskList({ tasks, disabled, display, canPropose, onOpen, onClose }: {
  tasks: ReviewTask[]; disabled: boolean; display: (v: string) => string; canPropose: boolean; onOpen: (task: ReviewTask) => void; onClose: (task: ReviewTask) => void
}) {
  const [limit, setLimit] = useState(20)
  return <div className="space-y-2"><p className="text-xs opacity-70">Задачи сохранены в вашем аккаунте. Изменившиеся разборы возвращаются на проверку и не пропускаются при переходе дальше.</p>
    {tasks.slice(0, limit).map((task) => <article key={task.id} className="space-y-2 rounded border border-current/20 p-2 text-sm">
      <p className="font-semibold">{display(task.surfaceForm)} · #{task.tokenIndex}</p><p>{DEFER_REASONS[task.reason]}</p>
      {task.note && <p className="whitespace-pre-wrap break-words text-xs">{task.note}</p>}
      {task.status === "ready" && <p className="text-xs text-blue-600 dark:text-blue-400">Разбор или заявка изменились — проверьте заново.</p>}
      {task.status === "conflict" && <p className="text-xs text-amber-600">Исходное вхождение изменилось или исчезло. Найдите его заново в очереди.</p>}
      {task.proposalId && <p className="text-xs">Заявка: {({ pending: "ожидает проверки", promoted: "передана в кандидаты", rejected: "отклонена", merged_into_existing: "связана с существующим словом" } as Record<string, string>)[task.proposalStatus || ""] || "статус недоступен"}{canPropose && task.proposalStatus === "pending" && <> · <Link className="underline" target="_blank" href={`/admin/corpus-candidates?cluster=${encodeURIComponent(normalizeSurfaceForm(task.surfaceForm))}`}>Открыть очередь ↗</Link></>}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={disabled || task.status === "conflict"} onClick={() => onOpen(task)}>Открыть</button><button type="button" className={button} disabled={disabled} onClick={() => onClose(task)}>Убрать из задач</button></div>
    </article>)}
    {!tasks.length && <p className="text-sm opacity-60">Отложенных задач нет.</p>}
    {limit < tasks.length && <button type="button" className={button} onClick={() => setLimit(limit + 20)}>Ещё задачи</button>}
  </div>
}
export function DeferForm({ canPropose, busy, initialValue, onCancel, onSubmit }: {
  canPropose: boolean; busy: boolean; initialValue: string; onCancel: () => void
  onSubmit: (value: { reason: DeferReason; note: string; proposal?: { value: string; pos: string } }) => void
}) {
  const [reason, setReason] = useState<DeferReason | "">("")
  const [note, setNote] = useState("")
  const [propose, setPropose] = useState(false)
  const [value, setValue] = useState(initialValue)
  const [pos, setPos] = useState("")
  return <form className="space-y-2 rounded border border-current/25 p-3" onSubmit={(e) => { e.preventDefault(); if (reason) onSubmit({ reason, note, ...(propose && canPropose && reason === "missing_lexeme" ? { proposal: { value: value.trim(), pos } } : {}) }) }}>
    <h3 className="text-sm font-semibold">Отложить с причиной</h3>
    <label className="block text-sm">Причина<select aria-label="Причина откладывания" required value={reason} disabled={busy} className={`${button} mt-1 w-full bg-transparent`} onChange={(e) => setReason(e.target.value as DeferReason)}><option value="">Выберите причину</option>{Object.entries(DEFER_REASONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="block text-sm">Комментарий<textarea aria-label="Комментарий к задаче" disabled={busy} className={`${button} mt-1 w-full bg-transparent`} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
    {reason === "missing_lexeme" && <>
      {canPropose ? <label className="flex gap-2 text-sm"><input type="checkbox" checked={propose} disabled={busy} onChange={(e) => setPropose(e.target.checked)} />Подготовить гипотезу в очереди кандидатов</label> : <p className="text-xs opacity-70">Для создания заявки нужно право на очередь кандидатов корпуса.</p>}
      {propose && canPropose && <><label className="block text-sm">Предполагаемая словарная форма<input aria-label="Предполагаемая словарная форма" className={`${button} mt-1 w-full bg-transparent`} disabled={busy} required maxLength={250} value={value} onChange={(e) => setValue(e.target.value)} /></label><label className="block text-sm">Предполагаемая часть речи<select aria-label="Предполагаемая часть речи" required disabled={busy} className={`${button} mt-1 w-full bg-transparent`} value={pos} onChange={(e) => setPos(e.target.value)}><option value="">Выберите часть речи</option>{["NOUN", "ADJ", "VERB", "ADV", "PRON", "NUM", "ADP", "CCONJ", "SCONJ", "PART", "INTJ"].map((p) => <option key={p}>{p}</option>)}</select></label><p className="text-xs opacity-70">Это гипотеза для модерации. Новая лексема и подтверждённые граммемы автоматически не создаются.</p></>}
    </>}
    <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || !reason}>Сохранить задачу и дальше</button><button type="button" className={button} disabled={busy} onClick={onCancel}>Отмена</button></div>
  </form>
}
