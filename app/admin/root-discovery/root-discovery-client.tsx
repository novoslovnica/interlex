"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { approveRootDiscoveryAction, rejectRootDiscoveryAction } from "./actions"

export interface ProposalDTO {
  id: number
  clusterKey: string
  proposedValue: string
  method: string
  strippedPrefix: string | null
  strippedSuffix: string | null
  occurrenceCount: number
  exampleLexemeIds: { id: number; value: string }[]
  protoSuggestion: { id: number; lemma: string } | null
  protoSuggestionScore: number | null
}

const METHOD_LABEL: Record<string, string> = {
  affix_strip: "по известным аффиксам",
  raw_substring_fallback: "по общей подстроке (менее надёжно)",
}

function ProposalCard({ proposal }: { proposal: ProposalDTO }) {
  const [isPending, startTransition] = useTransition()
  const [hidden, setHidden] = useState(false)
  const [value, setValue] = useState(proposal.proposedValue)
  const [acceptProto, setAcceptProto] = useState(true)
  const router = useRouter()

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveRootDiscoveryAction(proposal.id, value, acceptProto)
      if (result.success) {
        setHidden(true)
        router.refresh()
      } else {
        alert(`Ошибка: ${result.error}`)
      }
    })
  }

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectRootDiscoveryAction(proposal.id)
      if (result.success) {
        setHidden(true)
        router.refresh()
      } else {
        alert(`Ошибка: ${result.error}`)
      }
    })
  }

  if (hidden) return null

  const isFallback = proposal.method === "raw_substring_fallback"

  return (
    <div className={`border rounded-xl p-4 space-y-3 ${isFallback ? "border-dashed opacity-90" : ""}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-baseline gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="text-xl font-bold bg-transparent border-b border-dashed w-32 focus:outline-none focus:border-blue-500"
          />
          <span className="text-sm text-muted-foreground">{proposal.occurrenceCount} слов</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              isFallback ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            }`}
          >
            {METHOD_LABEL[proposal.method] ?? proposal.method}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReject}
            disabled={isPending}
            className="px-3 py-1 text-xs font-medium rounded border hover:bg-muted transition-colors disabled:opacity-50"
          >
            Отклонить
          </button>
          <button
            onClick={handleApprove}
            disabled={isPending || !value.trim()}
            className="px-3 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? "..." : "Создать корень"}
          </button>
        </div>
      </div>

      {(proposal.strippedPrefix || proposal.strippedSuffix) && (
        <p className="text-xs text-muted-foreground">
          {proposal.strippedPrefix && <>приставка «{proposal.strippedPrefix}» </>}
          {proposal.strippedSuffix && <>суффикс «{proposal.strippedSuffix}»</>}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {proposal.exampleLexemeIds.map((ex) => (
          <Link
            key={ex.id}
            href={`/words/${ex.id}`}
            target="_blank"
            className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/70 transition-colors"
          >
            {ex.value}
          </Link>
        ))}
        {proposal.occurrenceCount > proposal.exampleLexemeIds.length && (
          <span className="text-xs text-muted-foreground px-1">
            +{proposal.occurrenceCount - proposal.exampleLexemeIds.length}
          </span>
        )}
      </div>

      {proposal.protoSuggestion && (
        <label className="flex items-center gap-2 text-xs text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-md px-2 py-1.5 w-fit">
          <input type="checkbox" checked={acceptProto} onChange={(e) => setAcceptProto(e.target.checked)} />
          Привязать к /proto: <em>{proposal.protoSuggestion.lemma}</em>
          {proposal.protoSuggestionScore != null && ` (${Math.round(proposal.protoSuggestionScore * 100)}%)`}
        </label>
      )}
    </div>
  )
}

export default function RootDiscoveryClient({
  proposals,
  page,
  totalPages,
  total,
}: {
  proposals: ProposalDTO[]
  page: number
  totalPages: number
  total: number
}) {
  return (
    <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Новые корни (кандидаты)</h1>
        <span className="text-sm text-muted-foreground">На рассмотрении: {total}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Автопредложенные корневые гнёзда для слов, у которых сейчас нет привязанного корня — построены
        кластеризацией по известным приставкам/суффиксам (надёжнее) или по общей подстроке (менее надёжно,
        отмечено пунктиром). Одобрение создаёт настоящий корень и привязывает к нему все слова кластера;
        отклонение помечает предложение как непригодное — оно больше не появится здесь при повторной генерации.
      </p>

      {proposals.length === 0 && (
        <div className="text-center text-muted-foreground py-12">Нет предложений на рассмотрении</div>
      )}

      <div className="space-y-3">
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Страница {page} из {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/root-discovery?page=${page - 1}`} className="px-2 py-1 rounded border hover:bg-muted transition-colors">
                ← Назад
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/admin/root-discovery?page=${page + 1}`} className="px-2 py-1 rounded border hover:bg-muted transition-colors">
                Вперёд →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
