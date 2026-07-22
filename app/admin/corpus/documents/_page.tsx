"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"

interface Document {
  id: string
  title: string
  slug: string
  author: string | null
  createdAt: Date
  updatedAt: Date
  candidatesProcessed: boolean
}

export default function CorpusDocumentsPage({
  documents,
  freqLastRecalculated,
  cefrLastRecalculated,
  latestDocUpdatedAt,
}: {
  documents: Document[]
  freqLastRecalculated: string | null
  cefrLastRecalculated: string | null
  latestDocUpdatedAt: string | null
}) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const [computing, setComputing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const freqIsOutdated =
    freqLastRecalculated &&
    latestDocUpdatedAt &&
    new Date(latestDocUpdatedAt) > new Date(freqLastRecalculated)

  async function handleRecompute() {
    setComputing(true)
    setResult(null)
    try {
      const res = await fetch("/api/admin/recompute-frequencies", { method: "POST" })
      const data = await res.json()
      if (data.ok) {
        setResult(
          `Обновлено ${data.updated} лексем, всего токенов: ${data.totalTokens}, Zipf alpha: ${data.zipfAlpha ?? "—"}. CEFR: ${data.cefrUpdated} лексем.`,
        )
      } else {
        setResult(`Ошибка: ${data.error}`)
      }
    } catch (e) {
      setResult(`Ошибка запроса: ${e instanceof Error ? e.message : "Unknown"}`)
    } finally {
      setComputing(false)
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleString("ru-RU", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-background text-foreground">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Документы корпуса</h1>
        <div className="flex items-center gap-4">
          <div className="text-xs text-muted-foreground text-right leading-relaxed">
            <div>Частотность: {formatDate(freqLastRecalculated)}</div>
            <div>CEFR: {formatDate(cefrLastRecalculated)}</div>
          </div>
          {isAdmin && (
            <button
              onClick={handleRecompute}
              disabled={computing}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {computing ? "Пересчёт..." : "Пересчитать частотность и CEFR"}
            </button>
          )}
        </div>
      </div>

      {result && (
        <div className="mb-4 p-3 rounded-lg bg-muted text-sm text-muted-foreground">{result}</div>
      )}

      {freqIsOutdated && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Частотность и CEFR устарели. После последнего пересчёта документы были изменены.
            Нажмите «Пересчитать частотность и CEFR», чтобы обновить данные.
          </span>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Название</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Автор</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Дата добавления</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Кандидаты</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Действия</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/admin/corpus/documents/${doc.slug}`}
                    className="text-primary hover:underline"
                  >
                    {doc.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{doc.author || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(doc.createdAt).toLocaleDateString("ru-RU", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">
                  {doc.candidatesProcessed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Собраны
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                      </svg>
                      Не собраны
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`/api/admin/corpus/documents/${doc.slug}/tei`}
                    download
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border border-muted-foreground/20 hover:bg-muted/50 hover:border-foreground/40 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                      <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                    </svg>
                    TEI
                  </a>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  В корпусе пока нет документов.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}