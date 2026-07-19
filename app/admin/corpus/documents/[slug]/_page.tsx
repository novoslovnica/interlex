"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface DocumentData {
  id: string
  title: string
  slug: string
  author: string | null
  rawText: string
  language: string
  createdAt: Date
  candidatesProcessed: boolean
  _count: {
    tokens: number
    sentences: number
    segments: number
  }
}

interface Metrics {
  oovRate: number
  oovCount: number
  punctDensity: number
  punctCount: number
  nonPunctTokens: number
  whitespaceWords: number
}

export default function CorpusDocumentEditPage({
  document,
  metrics,
}: {
  document: DocumentData
  metrics: Metrics
}) {
  const router = useRouter()
  const [title, setTitle] = useState(document.title)
  const [author, setAuthor] = useState(document.author ?? "")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/corpus/documents/${document.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage({ type: "success", text: "Документ обновлён" })
        router.refresh()
      } else {
        setMessage({ type: "error", text: data.error ?? "Ошибка сохранения" })
      }
    } catch {
      setMessage({ type: "error", text: "Ошибка запроса" })
    } finally {
      setSaving(false)
    }
  }, [title, author, document.slug, router])

  const tokenChecksumOk = metrics.nonPunctTokens === metrics.whitespaceWords

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-background text-foreground">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <a
              href="/admin/corpus/documents"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Назад к документам
            </a>
            <h1 className="text-2xl font-bold mt-1">Редактирование документа</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="rounded-lg border overflow-hidden mb-6">
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Название
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Slug (не редактируется)
              </label>
              <input
                type="text"
                value={document.slug}
                disabled
                className="w-full px-3 py-2 rounded-lg border bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Автор
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Не указан"
                className="w-full px-3 py-2 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Link
            href={`/admin/corpus/documents/${document.slug}/segments`}
            className="rounded-lg border p-4 text-center hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <div className="text-2xl font-bold">{document._count.segments}</div>
            <div className="text-xs text-muted-foreground mt-1">Абзацев</div>
          </Link>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold">{document._count.sentences}</div>
            <div className="text-xs text-muted-foreground mt-1">Предложений</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold">{document._count.tokens}</div>
            <div className="text-xs text-muted-foreground mt-1">Токенов</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div
              className={`text-2xl font-bold ${metrics.oovRate > 20 ? "text-red-500" : metrics.oovRate > 10 ? "text-yellow-500" : "text-green-600 dark:text-green-400"}`}
            >
              {metrics.oovRate}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              OOV ({metrics.oovCount} не найдено)
            </div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold">{metrics.punctDensity}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              Пунктуация ({metrics.punctCount})
            </div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div
              className={`text-2xl font-bold ${tokenChecksumOk ? "text-green-600 dark:text-green-400" : "text-red-500"}`}
            >
              {metrics.nonPunctTokens}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Слов в тексте / {metrics.whitespaceWords}{" "}
              {!tokenChecksumOk && "⚠️"}
            </div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold">
              {document.candidatesProcessed ? "Да" : "Нет"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Кандидаты</div>
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <div className="px-4 py-3 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
            Исходный текст
          </div>
          <pre className="p-4 text-sm whitespace-pre-wrap font-sans max-h-96 overflow-y-auto">
            {document.rawText}
          </pre>
        </div>
      </div>
    </div>
  )
}