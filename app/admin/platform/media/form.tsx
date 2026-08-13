"use client"

import { useState, useEffect } from "react"
import { useFormStatus } from "react-dom"

const MEDIA_TYPES = [
  { value: "podcast", label: "Подкаст" },
  { value: "youtube_channel", label: "YouTube-канал" },
  { value: "video", label: "Видео" },
  { value: "audio_track", label: "Аудиозапись" },
  { value: "other", label: "Другое" },
]

const PLATFORMS = [
  { value: "", label: "—" },
  { value: "youtube", label: "YouTube" },
  { value: "spotify", label: "Spotify" },
  { value: "soundcloud", label: "SoundCloud" },
  { value: "apple_podcasts", label: "Apple Podcasts" },
  { value: "other", label: "Другое" },
]

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

interface MediaLibraryFormProps {
  action: (formData: FormData) => Promise<void>
  initial?: {
    slug: string
    title: string
    mediaType: string
    url: string
    platform: string
    description: string
    thumbnailUrl: string
    language: string
    verified: boolean
    isPublic: boolean
  }
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
    >
      {pending ? "Сохранение..." : "Сохранить"}
    </button>
  )
}

export function MediaLibraryForm({ action, initial }: MediaLibraryFormProps) {
  const [title, setTitle] = useState(initial?.title || "")
  const [slug, setSlug] = useState(initial?.slug || "")

  useEffect(() => {
    if (!initial?.slug) setSlug(generateSlug(title))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  return (
    <form action={action} className="space-y-4 max-w-xl">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Название</label>
        <input
          name="title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm rounded border bg-background"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Slug</label>
        <input
          name="slug"
          value={slug}
          onChange={e => setSlug(e.target.value)}
          required
          pattern="[a-z0-9-]+"
          className="w-full px-3 py-2 text-sm rounded border bg-background font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Тип</label>
          <select name="mediaType" defaultValue={initial?.mediaType || "podcast"} className="w-full px-3 py-2 text-sm rounded border bg-background">
            {MEDIA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Платформа</label>
          <select name="platform" defaultValue={initial?.platform || ""} className="w-full px-3 py-2 text-sm rounded border bg-background">
            {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Ссылка (URL)</label>
        <input
          name="url"
          type="url"
          defaultValue={initial?.url || ""}
          required
          placeholder="https://..."
          className="w-full px-3 py-2 text-sm rounded border bg-background"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Описание</label>
        <textarea
          name="description"
          defaultValue={initial?.description || ""}
          rows={3}
          className="w-full px-3 py-2 text-sm rounded border bg-background resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Превью (URL картинки)</label>
          <input
            name="thumbnailUrl"
            type="url"
            defaultValue={initial?.thumbnailUrl || ""}
            className="w-full px-3 py-2 text-sm rounded border bg-background"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Язык</label>
          <input
            name="language"
            defaultValue={initial?.language || "isv"}
            placeholder="isv, isv+ru..."
            className="w-full px-3 py-2 text-sm rounded border bg-background"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="verified" defaultChecked={initial?.verified ?? false} />
          Проверено
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublic" defaultChecked={initial?.isPublic ?? true} />
          Публично
        </label>
      </div>

      <SubmitButton />
    </form>
  )
}
