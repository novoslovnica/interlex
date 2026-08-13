"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createCandidateFromSuggestionAction, rejectSuggestionAction } from "./actions"

export interface SuggestionDTO {
  id: number
  createdAt: string
  suggestedValue: string | null
  meaningText: string
  exampleSentence: string | null
  sourceNote: string | null
  submitter: string | null
}

function SuggestionCard({ suggestion }: { suggestion: SuggestionDTO }) {
  const [isPending, startTransition] = useTransition()
  const [note, setNote] = useState("")
  const [hidden, setHidden] = useState(false)
  const [createdCandidateId, setCreatedCandidateId] = useState<number | null>(null)
  const router = useRouter()

  const handleCreateCandidate = () => {
    startTransition(async () => {
      const result = await createCandidateFromSuggestionAction(suggestion.id)
      if (result.success) {
        setCreatedCandidateId(result.candidateId ?? null)
        router.refresh()
      } else {
        alert(`Ошибка: ${result.error}`)
      }
    })
  }

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectSuggestionAction(suggestion.id, note || undefined)
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
        <span className="text-lg font-bold">{suggestion.suggestedValue || "(слово не указано)"}</span>
        <span className="text-xs text-muted-foreground">{new Date(suggestion.createdAt).toLocaleString("ru-RU")}</span>
      </div>

      <div className="text-sm">{suggestion.meaningText}</div>
      {suggestion.exampleSentence && (
        <div className="text-sm italic text-muted-foreground">«{suggestion.exampleSentence}»</div>
      )}
      {suggestion.sourceNote && (
        <div className="text-xs text-muted-foreground">Заметка: {suggestion.sourceNote}</div>
      )}
      {suggestion.submitter && <div className="text-xs text-muted-foreground">От: {suggestion.submitter}</div>}

      {createdCandidateId ? (
        <div className="text-xs text-green-600 dark:text-green-500">
          Создан кандидат #{createdCandidateId} —{" "}
          <Link href="/admin/candidates" target="_blank" className="underline">открыть в разделе «Кандидаты»</Link>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Заметка модератора (необязательно)"
            className="w-full px-2 py-1.5 text-xs rounded border bg-background"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateCandidate}
              disabled={isPending}
              className="px-3 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? "..." : "Создать кандидата"}
            </button>
            <button
              onClick={handleReject}
              disabled={isPending}
              className="px-3 py-1 text-xs font-medium rounded border hover:bg-muted transition-colors disabled:opacity-50"
            >
              Отклонить
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function SuggestionsClient({
  suggestions,
  page,
  totalPages,
  total,
}: {
  suggestions: SuggestionDTO[]
  page: number
  totalPages: number
  total: number
}) {
  return (
    <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Предложенные слова</h1>
        <span className="text-sm text-muted-foreground">В очереди: {total}</span>
      </div>

      {suggestions.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">Нет ожидающих заявок</p>
      )}

      <div className="space-y-3">
        {suggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Страница {page} из {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/suggestions?page=${page - 1}`} className="px-2 py-1 rounded border hover:bg-muted transition-colors">← Назад</Link>
            )}
            {page < totalPages && (
              <Link href={`/admin/suggestions?page=${page + 1}`} className="px-2 py-1 rounded border hover:bg-muted transition-colors">Вперёд →</Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
