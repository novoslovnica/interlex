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
  candidatesProcessed: boolean
}

export default function CorpusDocumentsPage({ documents }: { documents: Document[] }) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const [computing, setComputing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleRecompute() {
    setComputing(true)
    setResult(null)
    try {
      const res = await fetch("/api/admin/recompute-frequencies", { method: "POST" })
      const data = await res.json()
      if (data.ok) {
        setResult(
          `Обновлено ${data.updated} лексем, всего токенов: ${data.totalTokens}, Zipf alpha: ${data.zipfAlpha ?? "—"}`,
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

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-background text-foreground">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Документы корпуса</h1>
        {isAdmin && (
          <button
            onClick={handleRecompute}
            disabled={computing}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {computing ? "Пересчёт..." : "Пересчитать частотность"}
          </button>
        )}
      </div>

      {result && (
        <div className="mb-4 p-3 rounded-lg bg-muted text-sm text-muted-foreground">{result}</div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Название</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Автор</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Дата добавления</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Кандидаты</th>
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
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
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