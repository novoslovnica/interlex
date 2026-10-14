"use client"

import { useCallback, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type {
  HomonymGroupCandidate,
  HomonymGroupDetail,
  HomonymGroupListRow,
} from "@/lib/corpus/fetchHomonymGroups"

interface Props {
  groups: HomonymGroupListRow[]
  total: number
  page: number
  pageSize: number
  search: string
}

function formatPerMln(value: number | null): string {
  if (value === null) return "—"
  if (value >= 100) return Math.round(value).toString()
  return value.toFixed(1)
}

function CandidateRow({
  candidate,
  groupTokenCount,
  onApply,
  disabled,
  pendingSlug,
}: {
  candidate: HomonymGroupCandidate
  groupTokenCount: number
  onApply: (wordSlug: string) => void
  disabled: boolean
  pendingSlug: string | null
}) {
  const share = groupTokenCount > 0 ? Math.round((candidate.currentWins / groupTokenCount) * 100) : 0
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-border first:border-t-0">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-sm">{candidate.value ?? candidate.lemma}</span>
          <span className="text-[11px] text-muted-foreground">{candidate.pos}</span>
          {candidate.value && candidate.value !== candidate.lemma && (
            <span className="text-[11px] text-muted-foreground">лемма: {candidate.lemma}</span>
          )}
          <span className="text-[11px] text-muted-foreground">≈{formatPerMln(candidate.corpusFrequencyPerMln)}/млн</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          сейчас так: {candidate.currentWins} ({share}%) · кандидат у {candidate.candidateTokens} токенов
        </div>
      </div>
      <button
        onClick={() => onApply(candidate.wordSlug)}
        disabled={disabled}
        className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {pendingSlug === candidate.wordSlug
          ? "Применяю..."
          : `Применить ко всем (${groupTokenCount.toLocaleString("ru-RU")})`}
      </button>
    </div>
  )
}

function GroupCard({
  group,
  index,
  onResolved,
}: {
  group: HomonymGroupListRow
  index: number
  onResolved: (groupKey: string, resolvedTokens: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<HomonymGroupDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const loadDetail = useCallback(async () => {
    if (detail) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/corpus/homonyms/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupKey: group.groupKey }),
      })
      if (!res.ok) throw new Error("Не удалось загрузить кандидатов")
      setDetail((await res.json()) as HomonymGroupDetail)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запроса")
    } finally {
      setLoading(false)
    }
  }, [detail, group.groupKey])

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    if (next) void loadDetail()
  }

  const apply = (wordSlug: string) => {
    setPendingSlug(wordSlug)
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/corpus/homonyms/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupKey: group.groupKey, wordSlug }),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Ошибка сохранения")
        onResolved(group.groupKey, data.resolvedTokens as number)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка запроса")
      } finally {
        setPendingSlug(null)
      }
    })
  }

  return (
    <div className="border rounded-xl bg-muted/10 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="min-w-0 flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground w-6 shrink-0">{index}</span>
          <span className="font-mono text-base truncate">{group.form}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {group.wordSlugs.length} лексем
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs text-muted-foreground">{group.documentCount} док.</span>
          <span className="font-semibold text-sm tabular-nums">
            {group.tokenCount.toLocaleString("ru-RU")}
          </span>
          <span className="text-muted-foreground">{expanded ? "−" : "+"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-background">
          {loading && <div className="px-4 py-3 text-xs text-muted-foreground animate-pulse">Загрузка...</div>}
          {error && <div className="px-4 py-3 text-xs text-red-500">{error}</div>}
          {detail && (
            <>
              <div className="px-4 py-2 text-[11px] text-muted-foreground border-b border-border">
                Конкурируют разные лексемы — выберите ту, что верна в этих токенах. Граммема у каждого
                токена подставится своя. Если лексемы на самом деле дубли, чините это в{" "}
                <Link href="/admin/deduplication" className="text-primary hover:underline">дедупликации</Link>.
              </div>
              {detail.candidates.map((c) => (
                <CandidateRow
                  key={c.wordSlug}
                  candidate={c}
                  groupTokenCount={group.tokenCount}
                  onApply={apply}
                  disabled={isPending}
                  pendingSlug={pendingSlug}
                />
              ))}
              {detail.example && (
                <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
                  <span className="font-medium">Пример: </span>
                  <span className="font-mono">{detail.example.surfaceForm}</span>
                  {" — "}
                  <span>{detail.example.sentence}</span>
                  <span className="ml-1 opacity-70">
                    ({detail.example.documentTitle})
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function HomonymsClient({ groups, total, page, pageSize, search }: Props) {
  const router = useRouter()
  const [resolved, setResolved] = useState<Record<string, number>>({})
  const [searchValue, setSearchValue] = useState(search)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const resolvedCount = Object.values(resolved).reduce((a, b) => a + b, 0)

  const handleResolved = (groupKey: string, resolvedTokens: number) => {
    setResolved((prev) => ({ ...prev, [groupKey]: resolvedTokens }))
    // Перечитываем очередь с сервера: список пересортируется по оставшимся
    // токенам, а закрытая группа из него уйдёт.
    router.refresh()
  }

  const pageHref = (target: number) => {
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    if (target > 1) params.set("page", String(target))
    const qs = params.toString()
    return `/admin/corpus/homonyms${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Омонимия корпуса: массовая разметка</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Токены одной словоформы с одним и тем же набором конкурирующих лексем собраны в группы —
          решение по группе применяется ко всем её токенам сразу. Сюда попадает только конкуренция
          РАЗНЫХ лексем; спор о граммеме одной лексемы решается ранжированием и синтаксисом, а не
          модератором, и в очередь не выносится.
        </p>
        <p className="text-xs text-muted-foreground">
          Групп: <span className="font-semibold">{total.toLocaleString("ru-RU")}</span>
          {resolvedCount > 0 && (
            <> · в этой сессии размечено токенов: <span className="font-semibold">{resolvedCount.toLocaleString("ru-RU")}</span></>
          )}
        </p>
      </div>

      <form action="/admin/corpus/homonyms" method="get" className="flex gap-2 max-w-md">
        <input
          type="text"
          name="q"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Форма (начало слова), напр. ne"
          className="flex-1 px-3 py-1.5 text-sm rounded-md border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted/40 transition-colors"
        >
          Найти
        </button>
      </form>

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {search
            ? "Ничего не найдено по этому началу формы."
            : "Очередь пуста. Если она пуста неожиданно — не прогнан бэкфилл ключей групп или реанализ корпуса."}
        </p>
      )}

      <div className="space-y-2">
        {groups.map((g, idx) => (
          <GroupCard
            key={g.groupKey}
            group={g}
            index={(page - 1) * pageSize + idx + 1}
            onResolved={handleResolved}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 pt-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted/40 transition-colors">
              ← Назад
            </Link>
          )}
          <span className="text-xs text-muted-foreground">
            Страница {page} из {totalPages}
          </span>
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted/40 transition-colors">
              Вперёд →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
