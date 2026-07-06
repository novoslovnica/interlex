"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { MorphemeType } from "@/lib/grammar/common"

interface RootItem {
  id: number
  createdAt: string
  updatedAt: string
  value: string | null
  type: number | null
}

interface RootFull extends RootItem {
  roots_words: {
    id: number
    word: { id: number; value: string | null; isv: string | null } | null
  }[]
}

interface WordOption {
  id: number
  value: string | null
  isv: string | null
}

const ITEMS_PER_PAGE = 50

const MORPHEME_LABELS: Record<number, string> = {
  [MorphemeType.ROOT]: "Корень",
  [MorphemeType.PREFIX]: "Приставка",
  [MorphemeType.SUFFIX]: "Суффикс",
  [MorphemeType.UNKNOWN]: "Неизвестно",
}

const MORPHEME_OPTIONS = [
  { value: MorphemeType.ROOT, label: "Корень" },
  { value: MorphemeType.PREFIX, label: "Приставка" },
  { value: MorphemeType.SUFFIX, label: "Суффикс" },
  { value: MorphemeType.UNKNOWN, label: "Неизвестно" },
]

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function RootsClient() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <RootsClientInner />
    </QueryClientProvider>
  )
}

function RootsClientInner() {
  const [search, setSearch] = useState("")
  const [editRootId, setEditRootId] = useState<number | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["roots", debouncedSearch],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        offset: String(pageParam),
        limit: String(ITEMS_PER_PAGE),
        admin: "true",
      })
      if (debouncedSearch.trim()) params.set("query", debouncedSearch)
      const res = await fetch(`/api/roots?${params}`)
      return res.json() as Promise<{ items: RootItem[]; total: number }>
    },
    getNextPageParam: (lastPage, pages) => {
      const totalLoaded = pages.reduce((sum, p) => sum + p.items.length, 0)
      if (totalLoaded >= lastPage.total) return undefined
      return totalLoaded
    },
    initialPageParam: 0,
  })

  const { data: editRoot } = useQuery({
    queryKey: ["root", editRootId],
    queryFn: async () => {
      if (!editRootId) return null
      const res = await fetch(`/api/roots/${editRootId}`)
      return res.json() as Promise<RootFull>
    },
    enabled: editRootId !== null,
  })

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchNextPage()
      },
      { threshold: 0.1 }
    )
    const el = loadMoreRef.current
    if (el) observer.observe(el)
    return () => {
      if (el) observer.unobserve(el)
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, data])

  const allItems = data?.pages.flatMap((p) => p.items) ?? []

  const typeLabel = (t: number | null) =>
    t !== null ? MORPHEME_LABELS[t] ?? String(t) : "—"

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 text-sm text-foreground flex-1 overflow-y-auto min-h-0">
      <div className="border-b pb-4 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Корни (морфемы)</h1>
          <p className="text-xs text-muted-foreground">
            Редактирование корней и управление связанными словами.
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-all shadow-sm"
        >
          + Создать корень
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/20 p-4 rounded-xl border shrink-0">
        <div className="w-full sm:flex-1 relative">
          <input
            type="text"
            placeholder="Поиск по значению корня..."
            className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isLoading && (
            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground animate-pulse">
              Поиск...
            </span>
          )}
        </div>
      </div>

      <div className="overflow-auto max-h-[500px] border rounded-xl bg-background shadow-sm overflow-x-auto max-w-full">
        <table className="w-full text-left border-collapse table-fixed min-w-[600px]">
          <thead>
            <tr className="bg-muted text-xs font-semibold uppercase border-b">
              <th className="p-3">ID</th>
              <th className="p-3">Значение</th>
              <th className="p-3">Тип</th>
              <th className="p-3">Создан</th>
              <th className="p-3 w-24">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {allItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  {isLoading ? "Загрузка..." : "Нет корней"}
                </td>
              </tr>
            ) : (
              allItems.map((root) => (
                <tr key={root.id} className="hover:bg-muted/10 transition-colors">
                  <td className="p-3 text-muted-foreground">{root.id}</td>
                  <td className="p-3 font-semibold">{root.value || "—"}</td>
                  <td className="p-3">{typeLabel(root.type)}</td>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(root.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditRootId(root.id)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Править
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(root.id)}
                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        ref={loadMoreRef}
        className="py-4 text-center text-xs text-muted-foreground"
      >
        {isFetchingNextPage
          ? "Загрузка..."
          : hasNextPage
          ? "Прокрутите для загрузки"
          : "Все корни загружены"}
      </div>

      {editRootId !== null && editRoot && (
        <EditRootModal
          root={editRoot}
          onClose={() => setEditRootId(null)}
          onSaved={() => {
            setEditRootId(null)
            refetch()
          }}
        />
      )}

      {createModalOpen && (
        <CreateRootModal
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => {
            setCreateModalOpen(false)
            refetch()
          }}
        />
      )}

      {deleteConfirmId !== null && (
        <DeleteRootModal
          rootId={deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          onDeleted={() => {
            setDeleteConfirmId(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}

function MorphemeTypeSelect({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <select
      className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {MORPHEME_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function EditRootModal({
  root,
  onClose,
  onSaved,
}: {
  root: RootFull
  onClose: () => void
  onSaved: () => void
}) {
  const [value, setValue] = useState(root.value ?? "")
  const [type, setType] = useState(root.type ?? 0)
  const [saving, setSaving] = useState(false)
  const [wordSearch, setWordSearch] = useState("")
  const [addingWord, setAddingWord] = useState(false)

  const debouncedWordSearch = useDebounce(wordSearch, 400)

  const { data: wordResults } = useQuery({
    queryKey: ["words-search", debouncedWordSearch],
    queryFn: async () => {
      if (!debouncedWordSearch.trim()) return []
      const res = await fetch(
        `/api/words/search?query=${encodeURIComponent(debouncedWordSearch)}`
      )
      return res.json() as Promise<WordOption[]>
    },
    enabled: debouncedWordSearch.trim().length > 0,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/roots/${root.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, type }),
      })
      if (res.ok) onSaved()
      else alert("Ошибка при сохранении")
    } catch {
      alert("Ошибка при сохранении")
    }
    setSaving(false)
  }

  const handleAddWord = async (wordId: number) => {
    setAddingWord(true)
    try {
      const res = await fetch(`/api/roots/${root.id}/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId }),
      })
      if (res.ok) {
        setWordSearch("")
        onSaved()
      } else {
        const data = await res.json()
        if (res.status === 409) alert("Слово уже привязано к этому корню")
        else alert("Ошибка при добавлении слова")
      }
    } catch {
      alert("Ошибка при добавлении слова")
    }
    setAddingWord(false)
  }

  const handleRemoveWord = async (rootWordId: number) => {
    try {
      const res = await fetch(`/api/roots/${root.id}/words`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootWordId }),
      })
      if (res.ok) onSaved()
      else alert("Ошибка при удалении слова")
    } catch {
      alert("Ошибка при удалении слова")
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden">
      <div className="bg-background border rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="p-5 border-b flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-base font-bold">Редактирование корня</h3>
            <p className="text-xs text-muted-foreground">ID: {root.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 text-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Значение</label>
              <input
                type="text"
                className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Тип морфемы</label>
              <MorphemeTypeSelect value={type} onChange={setType} />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-2">
              Связанные слова ({root.roots_words.length})
            </h4>

            {root.roots_words.length > 0 ? (
              <div className="space-y-1 mb-3">
                {root.roots_words.map((rw) => (
                  <div
                    key={rw.id}
                    className="flex items-center justify-between bg-muted/20 px-3 py-1.5 rounded-md"
                  >
                    <span className="text-sm">
                      {rw.word?.value || "—"}
                      {rw.word?.isv ? (
                        <span className="text-blue-600 ml-1">({rw.word.isv})</span>
                      ) : null}
                      <span className="text-muted-foreground ml-1">
                        ID: {rw.word?.id}
                      </span>
                    </span>
                    <button
                      onClick={() => handleRemoveWord(rw.id)}
                      className="text-red-600 hover:text-red-800 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mb-3">
                Нет связанных слов
              </p>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1">
                Добавить слово
              </label>
              <input
                type="text"
                placeholder="Поиск слова..."
                className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500 mb-1"
                value={wordSearch}
                onChange={(e) => setWordSearch(e.target.value)}
              />
              {wordResults && wordResults.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {wordResults
                    .filter(
                      (w) =>
                        !root.roots_words.some(
                          (rw) => rw.word?.id === w.id
                        )
                    )
                    .map((w) => (
                      <button
                        key={w.id}
                        onClick={() => handleAddWord(w.id)}
                        disabled={addingWord}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/20 transition-colors disabled:opacity-50"
                      >
                        {w.value || "—"}{" "}
                        {w.isv ? (
                          <span className="text-blue-600">({w.isv})</span>
                        ) : null}
                        <span className="text-muted-foreground ml-1">
                          ID: {w.id}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-muted/10 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md text-xs font-semibold hover:bg-background transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateRootModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [value, setValue] = useState("")
  const [type, setType] = useState(MorphemeType.ROOT)
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!value.trim()) {
      alert("Значение корня обязательно")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/roots/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, type }),
      })
      if (res.ok) onCreated()
      else {
        const data = await res.json()
        alert(`Ошибка: ${data.error}`)
      }
    } catch {
      alert("Ошибка при создании корня")
    }
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-background border rounded-2xl w-full max-w-md shadow-xl p-6 space-y-4">
        <h3 className="text-base font-bold">Создание корня</h3>

        <div>
          <label className="block text-xs font-semibold mb-1">Значение</label>
          <input
            type="text"
            className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Тип морфемы</label>
          <MorphemeTypeSelect value={type} onChange={setType} />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md text-xs font-semibold hover:bg-background transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !value.trim()}
            className="px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {creating ? "Создание..." : "Создать"}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteRootModal({
  rootId,
  onClose,
  onDeleted,
}: {
  rootId: number
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/roots/${rootId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) onDeleted()
      else alert("Ошибка при удалении")
    } catch {
      alert("Ошибка при удалении")
    }
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-background border rounded-2xl w-full max-w-md shadow-xl p-6 space-y-4">
        <h3 className="text-base font-bold">Подтверждение удаления</h3>
        <p className="text-sm text-muted-foreground">
          Вы уверены, что хотите удалить корень ID: {rootId}? Связанные записи
          (roots_words) будут удалены каскадно.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md text-xs font-semibold hover:bg-background transition-colors"
            disabled={deleting}
          >
            Отмена
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white font-semibold text-xs rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {deleting ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  )
}