"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { approveHypothesisAction, rejectClusterAction } from "./actions"

export interface HypothesisDTO {
  id: number
  ruleSource: string
  guessedPos: string
  guessedStemType: string
  guessedStem: string
  reconstructedForm: string
  siblingWordSlug: string | null
  possibleEndingGap: boolean
  exampleTokenIds: string[]
}

export interface ClusterDTO {
  clusterKey: string
  occurrenceCount: number
  hypotheses: HypothesisDTO[]
}

const RULE_SOURCE_LABEL: Record<string, string> = {
  red_reverse_lookup: "красный — основа не найдена",
  yellow_stem_sibling: "жёлтый — основа похожа на существующее слово",
}

const REJECT_REASONS = [
  { value: "typo", label: "Опечатка" },
  { value: "proper_noun", label: "Имя собственное" },
  { value: "foreign", label: "Иностранное слово" },
  { value: "ending_gap", label: "Пробел в парадигме, не новое слово" },
  { value: "other", label: "Другое" },
]

function HypothesisCard({ h }: { h: HypothesisDTO }) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<string | null>(null)
  const router = useRouter()

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveHypothesisAction(h.id)
      if (result.success) {
        setDone("promoted")
        router.refresh()
      } else {
        alert(`Ошибка: ${result.error}`)
      }
    })
  }

  if (done) return null

  return (
    <div className="border rounded-lg p-3 flex flex-col gap-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{h.reconstructedForm}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{h.guessedPos}</span>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div>Класс основы: <span className="font-mono">{h.guessedStemType}</span>, основа: <span className="font-mono">{h.guessedStem}</span></div>
        <div>{RULE_SOURCE_LABEL[h.ruleSource] ?? h.ruleSource}</div>
        {h.siblingWordSlug && (
          <div>
            Похоже на корень слова{" "}
            <Link href={`/words/${h.siblingWordSlug}`} target="_blank" className="underline">
              {h.siblingWordSlug}
            </Link>
          </div>
        )}
        {h.possibleEndingGap && (
          <div className="text-amber-600 dark:text-amber-500">
            ⚠ Основа совпадает с уже существующим словом целиком — возможно, это пробел в парадигме, а не новое слово
          </div>
        )}
      </div>
      <button
        onClick={handleApprove}
        disabled={isPending}
        className="self-start px-3 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isPending ? "..." : "Одобрить как кандидата"}
      </button>
    </div>
  )
}

function ClusterCard({ cluster }: { cluster: ClusterDTO }) {
  const [isPending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState(REJECT_REASONS[0].value)
  const [hidden, setHidden] = useState(false)
  const router = useRouter()

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectClusterAction(cluster.clusterKey, reason)
      if (result.success) {
        setHidden(true)
        router.refresh()
      } else {
        alert(`Ошибка: ${result.error}`)
      }
    })
  }

  if (hidden) return null

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold">{cluster.clusterKey}</span>
          <span className="text-sm text-muted-foreground">встречается {cluster.occurrenceCount} раз</span>
        </div>
        <div className="flex items-center gap-2">
          {rejectOpen ? (
            <>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="px-2 py-1 text-xs rounded border bg-background"
              >
                {REJECT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="px-3 py-1 text-xs font-medium rounded bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? "..." : "Подтвердить"}
              </button>
              <button
                onClick={() => setRejectOpen(false)}
                className="px-2 py-1 text-xs rounded border hover:bg-muted transition-colors"
              >
                Отмена
              </button>
            </>
          ) : (
            <button
              onClick={() => setRejectOpen(true)}
              className="px-3 py-1 text-xs font-medium rounded border hover:bg-muted transition-colors"
            >
              Отклонить всё
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cluster.hypotheses.map((h) => (
          <HypothesisCard key={h.id} h={h} />
        ))}
      </div>
    </div>
  )
}

export default function CorpusCandidatesClient({
  clusters,
  page,
  totalPages,
  totalClusters,
}: {
  clusters: ClusterDTO[]
  page: number
  totalPages: number
  totalClusters: number
}) {
  return (
    <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Кандидаты из корпуса</h1>
        <span className="text-sm text-muted-foreground">Слов на рассмотрении: {totalClusters}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Автосгенерированные гипотезы восстановления словарной формы для слов из корпуса, которые не удалось
        распознать (красные) или у которых основа совпала с существующим словом, но флексия — нет (жёлтые).
        Одобрение создаёт запись в «Кандидатах» для дальнейшей проверки; отклонение помечает слово как
        неподходящее — оно больше не появится здесь при повторной генерации.
      </p>

      {clusters.length === 0 && (
        <div className="text-center text-muted-foreground py-12">Нет кандидатов на рассмотрении</div>
      )}

      <div className="space-y-4">
        {clusters.map((cluster) => (
          <ClusterCard key={cluster.clusterKey} cluster={cluster} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Страница {page} из {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/corpus-candidates?page=${page - 1}`} className="px-2 py-1 rounded border hover:bg-muted transition-colors">
                ← Назад
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/admin/corpus-candidates?page=${page + 1}`} className="px-2 py-1 rounded border hover:bg-muted transition-colors">
                Вперёд →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
