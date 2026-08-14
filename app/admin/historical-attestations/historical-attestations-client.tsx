"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { confirmAttestationAction, rejectAttestationAction, reassignAttestationAction } from "./actions"

interface LexemeSearchResult {
  id: number
  value: string | null
  pos: string | null
}

export interface AttestationDTO {
  id: number
  branch: string
  branchLabel: string
  historicalLemma: string
  matchMethod: string
  confidence: number
  occurrenceCount: number
  lexeme: { id: number; slug: string; value: string | null; stem: string | null; proto: string | null; pos: string | null } | null
  examples: { form: string; sentenceText: string; documentTitle: string }[]
}

const METHOD_LABEL: Record<string, string> = {
  proto_bridge: "прото-мост",
  phonetic_heuristic: "фонетич. эвристика",
}

const BRANCH_FILTERS = [
  { value: undefined, label: "Все" },
  { value: "east", label: "Восточнослав." },
  { value: "south", label: "Старославянская" },
  { value: "balkan", label: "Балканослав." },
]

function AttestationCard({ a }: { a: AttestationDTO }) {
  const [isPending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [note, setNote] = useState("")
  const [hidden, setHidden] = useState(false)
  const router = useRouter()

  const [reassignOpen, setReassignOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LexemeSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<LexemeSearchResult | null>(null)

  useEffect(() => {
    if (!reassignOpen || query.trim().length < 2) {
      setResults([])
      return
    }
    const handle = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/lexicon?search=${encodeURIComponent(query.trim())}&limit=8`)
        if (res.ok) {
          const data = await res.json()
          const items = Array.isArray(data) ? data : []
          setResults(items.map((r: LexemeSearchResult) => ({ id: r.id, value: r.value, pos: r.pos })))
        }
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [query, reassignOpen])

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await confirmAttestationAction(a.id)
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
      const result = await rejectAttestationAction(a.id, note || undefined)
      if (result.success) {
        setHidden(true)
        router.refresh()
      } else {
        alert(`Ошибка: ${result.error}`)
      }
    })
  }

  const handleReassign = () => {
    if (!selected) return
    startTransition(async () => {
      const result = await reassignAttestationAction(a.id, selected.id)
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-bold">{a.historicalLemma}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{a.branchLabel}</span>
            <span className="text-xs text-muted-foreground">→</span>
            {a.lexeme ? (
              <Link href={`/words/${a.lexeme.id}`} target="_blank" className="text-lg font-semibold underline">
                {a.lexeme.value}
              </Link>
            ) : (
              <span className="text-sm text-destructive">лексема удалена</span>
            )}
            {a.lexeme?.pos && <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{a.lexeme.pos}</span>}
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>
              Встречается {a.occurrenceCount} раз · уверенность {(a.confidence * 100).toFixed(0)}% · {METHOD_LABEL[a.matchMethod] ?? a.matchMethod}
            </div>
            {a.lexeme?.stem && <div>основа: <span className="font-mono">{a.lexeme.stem}</span></div>}
            {a.lexeme?.proto && <div>прото-форма: <span className="font-mono">{a.lexeme.proto}</span></div>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rejectOpen ? (
            <>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Причина (необязательно)"
                className="px-2 py-1 text-xs rounded border bg-background w-40"
              />
              <button
                onClick={handleReject}
                disabled={isPending}
                className="px-3 py-1 text-xs font-medium rounded bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? "..." : "Подтвердить отказ"}
              </button>
              <button onClick={() => setRejectOpen(false)} className="px-2 py-1 text-xs rounded border hover:bg-muted transition-colors">
                Отмена
              </button>
            </>
          ) : reassignOpen ? (
            <button onClick={() => { setReassignOpen(false); setQuery(""); setSelected(null) }} className="px-2 py-1 text-xs rounded border hover:bg-muted transition-colors">
              Отмена
            </button>
          ) : (
            <>
              <button
                onClick={handleConfirm}
                disabled={isPending || !a.lexeme}
                className="px-3 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? "..." : "Подтвердить"}
              </button>
              <button
                onClick={() => setReassignOpen(true)}
                className="px-3 py-1 text-xs font-medium rounded border hover:bg-muted transition-colors"
              >
                Другая лексема
              </button>
              <button
                onClick={() => setRejectOpen(true)}
                className="px-3 py-1 text-xs font-medium rounded border hover:bg-muted transition-colors"
              >
                Отклонить
              </button>
            </>
          )}
        </div>
      </div>

      {reassignOpen && (
        <div className="border-t pt-2 space-y-2">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
            placeholder="Поиск лексемы по значению..."
            autoFocus
            className="w-full px-2 py-1 text-sm rounded border bg-background"
          />
          {searching && <div className="text-xs text-muted-foreground">Поиск...</div>}
          {!searching && results.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    selected?.id === r.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  {r.value} {r.pos && <span className="opacity-60">({r.pos})</span>}
                </button>
              ))}
            </div>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <div className="text-xs text-muted-foreground">Ничего не найдено</div>
          )}
          <button
            onClick={handleReassign}
            disabled={isPending || !selected}
            className="px-3 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? "..." : selected ? `Привязать к «${selected.value}»` : "Привязать"}
          </button>
        </div>
      )}

      {a.examples.length > 0 && (
        <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
          {a.examples.map((ex, i) => (
            <div key={i}>
              <span className="font-mono">{ex.form}</span> — «{ex.sentenceText}» <span className="italic">({ex.documentTitle})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HistoricalAttestationsClient({
  attestations,
  page,
  totalPages,
  totalCount,
  currentBranch,
}: {
  attestations: AttestationDTO[]
  page: number
  totalPages: number
  totalCount: number
  currentBranch?: string
}) {
  return (
    <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Исторические аттестации</h1>
        <span className="text-sm text-muted-foreground">На рассмотрении: {totalCount}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Автосопоставления слов из исторических корпусов (берестяные грамоты, старославянский, балканославянский) с
        лексемами — по звуковым законам ветви, ниже порога автоподтверждения. Подтверждение или отказ фиксируются
        окончательно: повторный прогон матчера их больше не тронет.
      </p>

      <div className="flex gap-2">
        {BRANCH_FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/historical-attestations?branch=${f.value}` : "/admin/historical-attestations"}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              currentBranch === f.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {attestations.length === 0 && (
        <div className="text-center text-muted-foreground py-12">Нет записей на рассмотрении</div>
      )}

      <div className="space-y-3">
        {attestations.map((a) => (
          <AttestationCard key={a.id} a={a} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Страница {page} из {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/historical-attestations?page=${page - 1}${currentBranch ? `&branch=${currentBranch}` : ""}`}
                className="px-2 py-1 rounded border hover:bg-muted transition-colors"
              >
                ← Назад
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/historical-attestations?page=${page + 1}${currentBranch ? `&branch=${currentBranch}` : ""}`}
                className="px-2 py-1 rounded border hover:bg-muted transition-colors"
              >
                Вперёд →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
