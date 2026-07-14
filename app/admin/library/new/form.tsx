"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { FLAVOR_CODES, FLAVOR_METADATA } from "@/config/flavor"
import ReactMarkdown from "react-markdown"
import { splitIntoChapters, joinChapters } from "@/lib/body"
import type { Chapter } from "@/lib/body"

interface EntryBrief {
  id: number
  title: string
  slug: string
}

const GENRES = [
  { value: "novel", label: "Roman" },
  { value: "novella", label: "Pověst" },
  { value: "short_story", label: "Razkaz" },
  { value: "miniature", label: "Miniatura" },
  { value: "poetry", label: "Poezija" },
  { value: "drama", label: "Drama" },
  { value: "song", label: "Pěsńa" },
  { value: "article", label: "Členok" },
  { value: "news", label: "Novosti" },
  { value: "essay", label: "Esej" },
  { value: "fairy_tale", label: "Bajka" },
  { value: "biography", label: "Biografija" },
  { value: "correspondence", label: "Korespondencija" },
] as const

const TOPICS = [
  { value: "fiction", label: "Fikcija" },
  { value: "history_society", label: "Historija i obščestvo" },
  { value: "language_culture", label: "Język i kultura" },
  { value: "folklore", label: "Folklore" },
  { value: "science_tech", label: "Nauka i tehnologije" },
  { value: "news_events", label: "Novosti i sobytja" },
] as const

const FLAVORS = FLAVOR_CODES.map(code => ({
  value: code,
  label: FLAVOR_METADATA[code].label,
}))

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

interface LibraryFormProps {
  action: (formData: FormData) => Promise<void>
  entries?: EntryBrief[]
  excludeIds?: number[]
  excludeFromChildSearch?: number[]
  initial?: {
    slug: string
    title: string
    author: string
    genre: string
    topic: string
    flavor: string
    body: string
    summary: string
    corpusSlug: string
    verified: boolean
    source: string
    yearWritten: number | null
    yearTranslated: number | null
    translator: string
    isPublic: boolean
    parentId: number | null
    coverImage: string
    audioFile: string
  }
  initialChildren?: EntryBrief[]
}

function SubmitButton({ uploading }: { uploading?: boolean }) {
  const { pending } = useFormStatus()
  const disabled = pending || uploading
  return (
    <button
      type="submit"
      disabled={disabled}
      className="px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
    >
      {uploading ? "Sylajem fajly..." : pending ? "Sohranjenje..." : "Sohraniti"}
    </button>
  )
}

function sanitize(content: string): string {
  return content.replace(/<script[\s\S]*?<\/script>/gi, "")
}

function useDebouncedSearch(query: string, excludeIds: Set<number>) {
  const [results, setResults] = useState<EntryBrief[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const excludeRef = useRef(excludeIds)
  excludeRef.current = excludeIds

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    const q = query.trim()
    if (!q) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/library/search?query=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data: EntryBrief[] = await res.json()
          setResults(data.filter(e => !excludeRef.current.has(e.id)))
        }
      } catch {
        // ignore
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timerRef.current)
  }, [query])

  return { results, isSearching }
}

function ParentSearch({
  entries,
  excludeIds,
  selectedParent,
  onSelect,
  onClear,
}: {
  entries?: EntryBrief[]
  excludeIds?: number[]
  selectedParent: EntryBrief | null
  onSelect: (entry: EntryBrief) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const exclude = new Set(excludeIds || [])
  const { results, isSearching } = useDebouncedSearch(query, exclude)

  const displayed = query.trim()
    ? results
    : (entries || []).filter(e => !exclude.has(e.id)).slice(0, 20)

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">Rodičevsky sbornik</label>
      {selectedParent ? (
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded bg-background">
          <span className="flex-1">{selectedParent.title}</span>
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
            placeholder="Iskanje sbornika..."
          />
          {focused && displayed.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 border rounded bg-background shadow-lg z-10 max-h-48 overflow-y-auto">
              {isSearching && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Iskanje...</div>
              )}
              {displayed.map(e => (
                <button
                  key={e.id}
                  type="button"
                  onMouseDown={() => onSelect(e)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                >
                  {e.title}
                  <span className="text-xs text-muted-foreground ml-2">({e.slug})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <input type="hidden" name="parentId" value={selectedParent?.id ?? ""} />
    </div>
  )
}

function ChildrenManager({
  initialChildren,
  excludeIds,
}: {
  initialChildren?: EntryBrief[]
  excludeIds?: number[]
}) {
  const [children, setChildren] = useState<EntryBrief[]>(initialChildren || [])
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)

  const childIds = new Set(children.map(c => c.id))
  const excluded = new Set([...(excludeIds || []), ...childIds])
  const { results, isSearching } = useDebouncedSearch(query, excluded)

  const addChild = useCallback((entry: EntryBrief) => {
    setChildren(prev => [...prev, entry])
    setQuery("")
  }, [])

  const removeChild = useCallback((id: number) => {
    setChildren(prev => prev.filter(c => c.id !== id))
  }, [])

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">Dětinske teksty</label>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
          placeholder="Iskanje i dobavjenje dětinskih tekstov..."
        />
        {focused && query.trim() && (
          <div className="absolute top-full left-0 right-0 mt-1 border rounded bg-background shadow-lg z-10 max-h-48 overflow-y-auto">
            {isSearching && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Iskanje...</div>
            )}
            {results.map(e => (
              <button
                key={e.id}
                type="button"
                onMouseDown={() => addChild(e)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              >
                {e.title}
                <span className="text-xs text-muted-foreground ml-2">({e.slug})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {children.length > 0 && (
        <div className="border rounded divide-y">
          {children.map(child => (
            <div key={child.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="flex-1">{child.title}</span>
              <button
                type="button"
                onClick={() => removeChild(child.id)}
                className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
              >
                Vymazati
              </button>
            </div>
          ))}
        </div>
      )}

      {children.map(child => (
        <input key={child.id} type="hidden" name="childIds" value={child.id} />
      ))}
    </div>
  )
}

function CoverImageBlock({ initial }: { initial?: string }) {
  const [preview, setPreview] = useState<string | null>(initial || null)
  const [deleteChecked, setDeleteChecked] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">Obkladka</label>
      {!deleteChecked && (
        <input
          ref={fileRef}
          type="file"
          name="coverImage"
          accept="image/*"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) setPreview(URL.createObjectURL(file))
          }}
          className="block w-full text-xs text-muted-foreground file:mr-2 file:px-2 file:py-1 file:text-xs file:rounded file:border file:bg-muted file:text-foreground hover:file:bg-muted/80"
        />
      )}
      {preview && !deleteChecked && (
        <div className="border rounded overflow-hidden bg-muted/20">
          <img src={preview} alt="Obkladka" className="w-full object-cover" style={{ maxHeight: 200 }} />
        </div>
      )}
      {initial && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          <input
            type="checkbox"
            name="deleteCoverImage"
            checked={deleteChecked}
            onChange={e => setDeleteChecked(e.target.checked)}
            className="rounded border text-red-500 focus:ring-red-500"
          />
          Vymazati obkladku
        </label>
      )}
    </div>
  )
}

function AudioBlock({ initial }: { initial?: string }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [deleteChecked, setDeleteChecked] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">Audio</label>
      {!deleteChecked && (
        <input
          ref={fileRef}
          type="file"
          name="audioFile"
          accept="audio/*"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) setPreview(URL.createObjectURL(file))
          }}
          className="block w-full text-xs text-muted-foreground file:mr-2 file:px-2 file:py-1 file:text-xs file:rounded file:border file:bg-muted file:text-foreground hover:file:bg-muted/80"
        />
      )}
      {(preview || initial) && !deleteChecked && (
        <div className="border rounded overflow-hidden bg-muted/20 p-2">
          <audio controls src={preview || initial} className="w-full" style={{ height: 40 }}>
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
      {initial && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          <input
            type="checkbox"
            name="deleteAudioFile"
            checked={deleteChecked}
            onChange={e => setDeleteChecked(e.target.checked)}
            className="rounded border text-red-500 focus:ring-red-500"
          />
          Vymazati audio
        </label>
      )}
    </div>
  )
}

export function LibraryForm({
  action,
  entries,
  initial,
  initialChildren,
  excludeIds,
  excludeFromChildSearch,
}: LibraryFormProps) {
  const [title, setTitle] = useState(initial?.title || "")
  const [slug, setSlug] = useState(initial?.slug || "")
  const [chapters, setChapters] = useState<Chapter[]>(() =>
    initial?.body ? splitIntoChapters(initial.body) : [{ heading: "", content: "" }]
  )
  const [activeChapter, setActiveChapter] = useState(0)
  const [editingHeading, setEditingHeading] = useState<number | null>(null)
  const [editHeadingValue, setEditHeadingValue] = useState("")
  const [selectedParent, setSelectedParent] = useState<EntryBrief | null>(
    initial?.parentId && entries
      ? entries.find(e => e.id === initial.parentId) || null
      : null
  )
  const [uploading, setUploading] = useState(false)

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTitle(value)
    if (!initial?.slug) {
      setSlug(generateSlug(value))
    }
  }, [initial?.slug])

  const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(e.target.value)
  }, [])

  const handleChapterContentChange = useCallback((index: number, content: string) => {
    setChapters(prev => prev.map((ch, i) => (i === index ? { ...ch, content } : ch)))
  }, [])

  const handleChapterHeadingChange = useCallback((index: number, heading: string) => {
    setChapters(prev => prev.map((ch, i) => (i === index ? { ...ch, heading } : ch)))
  }, [])

  const addChapter = useCallback(() => {
    setChapters(prev => [...prev, { heading: "", content: "" }])
    setActiveChapter(prev => prev + 1)
  }, [])

  const removeChapter = useCallback((index: number) => {
    setChapters(prev => {
      if (prev.length <= 1) return prev
      const next = prev.filter((_, i) => i !== index)
      setActiveChapter(a => {
        if (index < a) return a - 1
        if (index === a && a > 0) return a - 1
        return 0
      })
      return next
    })
  }, [])

  const handleParentSelect = useCallback((entry: EntryBrief) => {
    setSelectedParent(entry)
  }, [])

  const handleParentClear = useCallback(() => {
    setSelectedParent(null)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUploading(true)
    const form = e.currentTarget
    const fd = new FormData(form)

    const coverFile = (form.querySelector<HTMLInputElement>('input[name="coverImage"]'))?.files?.[0]
    if (coverFile) {
      const uploadFd = new FormData()
      uploadFd.set("file", coverFile)
      uploadFd.set("slug", fd.get("slug") as string)
      uploadFd.set("type", "cover")
      const res = await fetch("/api/admin/library/upload", { method: "POST", body: uploadFd })
      if (res.ok) {
        const { path } = await res.json()
        fd.set("coverImage", path)
      }
    }

    const audioFile = (form.querySelector<HTMLInputElement>('input[name="audioFile"]'))?.files?.[0]
    if (audioFile) {
      const uploadFd = new FormData()
      uploadFd.set("file", audioFile)
      uploadFd.set("slug", fd.get("slug") as string)
      uploadFd.set("type", "audio")
      const res = await fetch("/api/admin/library/upload", { method: "POST", body: uploadFd })
      if (res.ok) {
        const { path } = await res.json()
        fd.set("audioFile", path)
      }
    }

    setUploading(false)
    action(fd)
  }, [action])

  return (
    <form action={action} onSubmit={handleSubmit} className="relative space-y-4">
      <div className="grid grid-cols-[1fr_1fr_220px] gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Slug *</label>
          <input
            name="slug"
            value={slug}
            onChange={handleSlugChange}
            required
            className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
            placeholder="my-text-slug"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Nazvanje *</label>
          <input
            name="title"
            value={title}
            onChange={handleTitleChange}
            required
            className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
            placeholder="Nazvanje teksta"
          />
        </div>
        <div className="row-span-5 space-y-2">
          <CoverImageBlock initial={initial?.coverImage} />
          <AudioBlock initial={initial?.audioFile} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Žanr *</label>
          <select
            name="genre"
            defaultValue={initial?.genre || "article"}
            required
            className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="">Vyberite žanr</option>
            {GENRES.map(g => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tematika</label>
          <select
              name="topic"
              defaultValue={initial?.topic || ""}
              className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="">Bez temy</option>
            {TOPICS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Flavorizacija</label>
          <select
            name="flavor"
            defaultValue={initial?.flavor || "CORE"}
            className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
          >
            {FLAVORS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Odkazka na istočnik</label>
          <input
            name="source"
            defaultValue={initial?.source}
            className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
            placeholder="https://example.com/original-text"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Corpus slug</label>
          <input
            name="corpusSlug"
            defaultValue={initial?.corpusSlug}
            className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
            placeholder="Odkazka na dokument v korpusě"
          />
        </div>
      </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Autor</label>
              <input
                  name="author"
                  defaultValue={initial?.author}
                  className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
                  placeholder="Imja avtora"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">God napisanja</label>
              <input
                name="yearWritten"
                type="number"
                defaultValue={initial?.yearWritten ?? ""}
                min={-3000}
                max={2100}
                className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
                placeholder="2024"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Autor prěvoda</label>
              <input
                  name="translator"
                  defaultValue={initial?.translator}
                  className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
                  placeholder="Imja prěvodnika"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">God prěvoda</label>
              <input
                name="yearTranslated"
                type="number"
                defaultValue={initial?.yearTranslated ?? ""}
                min={-3000}
                max={2100}
                className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
                placeholder="2024"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Kratko opisanje</label>
            <textarea
              name="summary"
              defaultValue={initial?.summary}
              rows={5}
              className="w-full px-3 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-primary outline-none resize-y"
              placeholder="Kratko opisanje teksta"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="verified"
                defaultChecked={initial?.verified}
                className="rounded border text-primary focus:ring-primary"
              />
              <span className="text-muted-foreground">Ortografija proverjena</span>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="isPublic"
                defaultChecked={initial?.isPublic ?? true}
                className="rounded border text-primary focus:ring-primary"
              />
              <span className="text-muted-foreground">Publicny</span>
            </label>
          </div>

          <ParentSearch
            entries={entries}
            excludeIds={excludeIds}
            selectedParent={selectedParent}
            onSelect={handleParentSelect}
            onClear={handleParentClear}
          />

          <ChildrenManager
            initialChildren={initialChildren}
            excludeIds={excludeFromChildSearch}
          />

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tekst (Markdown)</label>

            <input type="hidden" name="body" value={joinChapters(chapters)} />

            <div className="border rounded">
              <div className="flex items-center gap-0.5 border-b bg-muted/20 overflow-x-auto">
                {chapters.map((ch, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveChapter(i)}
                    className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      i === activeChapter
                        ? "bg-background border-b-2 border-primary text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {editingHeading === i ? (
                      <input
                        autoFocus
                        value={editHeadingValue}
                        onChange={e => setEditHeadingValue(e.target.value)}
                        onBlur={() => {
                          handleChapterHeadingChange(i, editHeadingValue)
                          setEditingHeading(null)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleChapterHeadingChange(i, editHeadingValue)
                            setEditingHeading(null);
                            (e.target as HTMLInputElement).blur()
                          }
                          if (e.key === 'Escape') {
                            setEditingHeading(null)
                          }
                          e.stopPropagation()
                        }}
                        onClick={e => e.stopPropagation()}
                        className="w-24 bg-white dark:bg-gray-800 px-1 rounded border text-xs outline-none"
                      />
                    ) : (
                      <span
                        onDoubleClick={e => {
                          e.stopPropagation()
                          setEditingHeading(i)
                          setEditHeadingValue(ch.heading)
                        }}
                        className="cursor-default"
                      >
                        {ch.heading || (i === 0 ? "Úvod" : `Glava ${i + 1}`)}
                      </span>
                    )}
                    {chapters.length > 1 && (
                      <span
                        className="ml-1.5 cursor-pointer hover:text-red-500"
                        onClick={e => { e.stopPropagation(); removeChapter(i) }}
                      >
                        ✕
                      </span>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={addChapter}
                  className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  + Glava
                </button>
              </div>
              <div className="grid grid-cols-2 gap-0">
                <textarea
                  value={chapters[activeChapter]?.content || ""}
                  onChange={e => handleChapterContentChange(activeChapter, e.target.value)}
                  rows={20}
                  className="w-full px-3 py-1.5 text-sm border-r bg-background focus:ring-1 focus:ring-primary outline-none font-mono resize-y"
                  placeholder="Vvedite tekst v formatě Markdown..."
                />
                <div className="border-0 p-3 overflow-y-auto text-sm bg-background prose prose-sm dark:prose-invert max-w-none">
                  {chapters[activeChapter]?.content.trim() ? (
                    <ReactMarkdown>{sanitize(chapters[activeChapter].content)}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground italic">Predpohled</p>
                  )}
                </div>
              </div>
            </div>
          </div>

      <div className="fixed bottom-6 right-6 z-50 flex gap-2 bg-background/90 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
        <SubmitButton uploading={uploading} />
        <a
          href="/admin/library"
          className="px-4 py-2 text-sm font-medium rounded border hover:bg-muted transition-colors"
        >
          Otměna
        </a>
      </div>
    </form>
  )
}