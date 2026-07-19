"use client"

import { useState, useRef } from "react"

interface ImportStatus {
  type: "idle" | "uploading" | "saving" | "success" | "error"
  message: string
}

export default function CorpusImportClient() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [author, setAuthor] = useState("")
  const [status, setStatus] = useState<ImportStatus>({ type: "idle", message: "" })
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const base = f.name.replace(/\.\w+$/, "")
    if (!title) setTitle(base)
    if (!slug) {
      setSlug(
        base
          .toLowerCase()
          .replace(/[^a-zа-яё0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      )
    }
  }

  async function handleImport() {
    if (!file || !title || !slug) return
    setStatus({ type: "saving", message: "Чтение файла..." })

    let text: string
    try {
      text = await file.text()
    } catch {
      setStatus({ type: "error", message: "Ошибка чтения файла" })
      return
    }

    setStatus({ type: "saving", message: `Сохранение (${text.length} символов)...` })

    try {
      const res = await fetch("/api/corpus/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          rawText: text,
          author: author || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus({
          type: "success",
          message: `Импортирован: ${data.tokensProcessed} токенов`,
        })
        setFile(null)
        setTitle("")
        setSlug("")
        setAuthor("")
        fileRef.current!.value = ""
      } else {
        setStatus({ type: "error", message: `Ошибка: ${data.error}` })
      }
    } catch {
      setStatus({ type: "error", message: "Ошибка сети" })
    }
  }

  const isValid = file && title.trim() && slug.trim()

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-xl font-semibold">Импорт текста в корпус</h1>
        <p className="text-sm text-muted-foreground">
          Загрузите текстовый файл (.txt). Токенизация выполняется на сервере — браузер не рендерит токены.
        </p>

        {status.type === "success" && (
          <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-sm">
            {status.message}
          </div>
        )}
        {status.type === "error" && (
          <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 text-sm">
            {status.message}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Файл (.txt)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
            />
            {file && (
              <p className="mt-1 text-xs text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Название
            </label>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (!slug || slug === autoSlug(title)) {
                  setSlug(autoSlug(e.target.value))
                }
              }}
              className="w-full px-3 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="Название документа"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Slug (уникальный идентификатор)
            </label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-3 py-2 bg-muted rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-primary"
              placeholder="my-document"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Автор (необязательно)
            </label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-3 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="Автор"
            />
          </div>
        </div>

        <button
          onClick={handleImport}
          disabled={!isValid || status.type === "saving"}
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {status.type === "saving" ? status.message : "Импортировать"}
        </button>
      </div>
    </div>
  )

  function autoSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }
}