"use client"

import { useState, useCallback } from "react"
import Link from "next/link"

// Дублирует значения UD_DEPREL (lib/corpus/syntax/deprel.ts) как плоский
// список строк — не импортируем barrel lib/corpus/syntax в клиентский
// компонент напрямую: он тянет за собой persist.ts (prismaCorpus), не
// предназначенный для браузерного бандла.
const RELATIONS = [
  "root", "nsubj", "obj", "iobj", "obl", "amod", "nmod", "det", "nummod",
  "advmod", "case", "aux", "cop", "expl", "discourse", "punct", "dep",
  "cc", "conj", "mark", "advcl", "ccomp", "xcomp", "acl", "parataxis",
]

interface TokenData {
  id: string
  tokenIndex: number
  surfaceForm: string
  pos: string
}

interface EdgeData {
  depTokenId: string
  headTokenId: string | null
  relation: string
  confidence: string
  source: string
}

export interface SentenceData {
  id: string
  position: number
  rawText: string
  tokens: TokenData[]
  edges: EdgeData[]
}

function SentenceEditor({ sentence }: { sentence: SentenceData }) {
  const edgeByDep = new Map(sentence.edges.map(e => [e.depTokenId, e]))
  const [drafts, setDrafts] = useState<Record<string, { headTokenId: string; relation: string }>>(() => {
    const initial: Record<string, { headTokenId: string; relation: string }> = {}
    for (const t of sentence.tokens) {
      const e = edgeByDep.get(t.id)
      initial[t.id] = { headTokenId: e?.headTokenId ?? "", relation: e?.relation ?? "dep" }
    }
    return initial
  })
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedEdges, setSavedEdges] = useState<Record<string, EdgeData>>(() => {
    const initial: Record<string, EdgeData> = {}
    for (const e of sentence.edges) initial[e.depTokenId] = e
    return initial
  })
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async (depTokenId: string) => {
    setSavingId(depTokenId)
    setError(null)
    const draft = drafts[depTokenId]
    try {
      const res = await fetch("/api/admin/corpus/syntax/edge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depTokenId,
          headTokenId: draft.headTokenId || null,
          relation: draft.relation,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setSavedEdges(prev => ({ ...prev, [depTokenId]: data.edge }))
      } else {
        setError(data.error ?? "Ошибка сохранения")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запроса")
    } finally {
      setSavingId(null)
    }
  }, [drafts])

  const tokenLabel = (id: string) => {
    const t = sentence.tokens.find(x => x.id === id)
    return t ? `${t.surfaceForm} (${t.tokenIndex})` : id
  }

  return (
    <div className="rounded-lg border overflow-hidden mb-6">
      <div className="px-4 py-3 bg-muted/50 border-b">
        <div className="text-xs text-muted-foreground">#{sentence.position}</div>
        <div className="text-sm">{sentence.rawText}</div>
      </div>
      {error && (
        <div className="px-4 py-2 text-sm bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">{error}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Токен</th>
              <th className="px-3 py-2">POS</th>
              <th className="px-3 py-2">Голова</th>
              <th className="px-3 py-2">Связь</th>
              <th className="px-3 py-2">Источник</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sentence.tokens.map(t => {
              const draft = drafts[t.id]
              const saved = savedEdges[t.id]
              const dirty = draft.headTokenId !== (saved?.headTokenId ?? "") || draft.relation !== (saved?.relation ?? "dep")
              return (
                <tr key={t.id} className="border-b last:border-b-0">
                  <td className="px-3 py-1.5 font-medium">{t.surfaceForm}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{t.pos}</td>
                  <td className="px-3 py-1.5">
                    <select
                      value={draft.headTokenId}
                      onChange={e => setDrafts(prev => ({ ...prev, [t.id]: { ...prev[t.id], headTokenId: e.target.value } }))}
                      className="px-2 py-1 rounded border bg-background text-foreground text-xs max-w-[160px]"
                    >
                      <option value="">— ROOT —</option>
                      {sentence.tokens.filter(o => o.id !== t.id).map(o => (
                        <option key={o.id} value={o.id}>{tokenLabel(o.id)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={draft.relation}
                      onChange={e => setDrafts(prev => ({ ...prev, [t.id]: { ...prev[t.id], relation: e.target.value } }))}
                      className="px-2 py-1 rounded border bg-background text-foreground text-xs"
                    >
                      {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    {saved ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${saved.source === "manual" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                        {saved.source}/{saved.confidence}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() => handleSave(t.id)}
                      disabled={!dirty || savingId === t.id}
                      className="px-2 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      {savingId === t.id ? "..." : "Сохранить"}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SyntaxEditorClient({
  documentSlug,
  documentTitle,
  sentences,
  page,
  totalPages,
}: {
  documentSlug: string
  documentTitle: string
  sentences: SentenceData[]
  page: number
  totalPages: number
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6 bg-background text-foreground">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/admin/corpus/documents/${documentSlug}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Назад к документу
          </Link>
          <div className="flex items-center justify-between mt-1">
            <h1 className="text-2xl font-bold">Синтаксис: {documentTitle}</h1>
            <a
              href={`/api/admin/corpus/documents/${documentSlug}/conllu`}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border hover:bg-muted/20 transition-colors"
            >
              Скачать CoNLL-U
            </a>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Голова &laquo;— ROOT —&raquo; помечает корень клаузы. Изменения по одному токену сохраняются как ручная
            правка (source=manual) и не затираются повторным автоматическим разбором.
          </p>
        </div>

        {sentences.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            Нет предложений на этой странице.
          </div>
        )}

        {sentences.map(s => <SentenceEditor key={s.id} sentence={s} />)}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link
              href={`/admin/corpus/documents/${documentSlug}/syntax?page=${Math.max(1, page - 1)}`}
              aria-disabled={page <= 1}
              className={`px-3 py-1.5 text-sm rounded border ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted/20"}`}
            >
              ← Назад
            </Link>
            <span className="text-sm text-muted-foreground">Страница {page} из {totalPages}</span>
            <Link
              href={`/admin/corpus/documents/${documentSlug}/syntax?page=${Math.min(totalPages, page + 1)}`}
              aria-disabled={page >= totalPages}
              className={`px-3 py-1.5 text-sm rounded border ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-muted/20"}`}
            >
              Вперёд →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
