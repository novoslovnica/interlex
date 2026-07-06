"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { promoteCandidatesAction } from "./actions"

interface Candidate {
  id: number
  createdAt: string
  updatedAt: string
  value: string | null
  isv: string | null
  nsl: string | null
  transcription: string | null
  field: string | null
  type: string | null
  pos: string | null
  aspect: string | null
  transitivity: string | null
  animacy: string | null
  degree: string | null
  pronType: string | null
  numType: string | null
  frequency: string | null
  intelligibility: string | null
  addition: string | null
  sameInLanguages: string | null
  etymology: string | null
  proto: string | null
  paradigm: string | null
  protoStemClass: string | null
  stemExtension: string | null
  genesis: string | null
  base: string | null
  gender: string | null
  declension: number | null
  conjugation: number | null
  accentSyllable: number | null
  alternationType: string | null
  fleetingVowelAt: number | null
  hasAnomalies: boolean
  actionHistory: string | null
  promotedAt: string | null
  promotedToWordId: number | null
}

interface RootOption {
  id: number
  value: string | null
}

interface PromoteFormData {
  candidateId: number
  value: string
  pos: string
  base: string
  gender: string
  declension: number | null
  conjugation: number | null
  rootId: number | null
}

const ITEMS_PER_PAGE = 50

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function CandidatesClient() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <CandidatesClientInner />
    </QueryClientProvider>
  )
}

function CandidatesClientInner() {
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [promoteModalOpen, setPromoteModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [promoteForms, setPromoteForms] = useState<PromoteFormData[]>([])
  const [rootSearchQuery, setRootSearchQuery] = useState("")
  const [isPromoting, setIsPromoting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const debouncedSearch = useDebounce(search, 400)
  const debouncedRootSearch = useDebounce(rootSearchQuery, 400)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["candidates", debouncedSearch],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        offset: String(pageParam),
        limit: String(ITEMS_PER_PAGE),
      })
      if (debouncedSearch.trim()) params.set("search", debouncedSearch)
      const res = await fetch(`/api/candidates?${params}`)
      return res.json() as Promise<{ items: Candidate[]; total: number }>
    },
    getNextPageParam: (lastPage, pages) => {
      const totalLoaded = pages.reduce((sum, p) => sum + p.items.length, 0)
      if (totalLoaded >= lastPage.total) return undefined
      return totalLoaded
    },
    initialPageParam: 0,
  })

  const { data: rootResults } = useQuery({
    queryKey: ["roots-search", debouncedRootSearch],
    queryFn: async () => {
      if (!debouncedRootSearch.trim()) return []
      const res = await fetch(`/api/roots?query=${encodeURIComponent(debouncedRootSearch)}`)
      const data = await res.json()
      return (data as RootOption[]).map((r: { id: number; value: string | null }) => ({
        id: r.id,
        value: r.value,
      }))
    },
    enabled: debouncedRootSearch.trim().length > 0,
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
    return () => { if (el) observer.unobserve(el) }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, data])

  const allItems = data?.pages.flatMap((p) => p.items) ?? []

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === allItems.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(allItems.map((i) => i.id))
    }
  }, [allItems, selectedIds])

  const openPromoteModal = useCallback(() => {
    const selected = allItems.filter((i) => selectedIds.includes(i.id))
    setPromoteForms(
      selected.map((c) => ({
        candidateId: c.id,
        value: c.value || "",
        pos: c.pos || "",
        base: c.base || "",
        gender: c.gender || "",
        declension: c.declension,
        conjugation: c.conjugation,
        rootId: null,
      }))
    )
    setRootSearchQuery("")
    setPromoteModalOpen(true)
  }, [allItems, selectedIds])

  const updateForm = useCallback(
    (index: number, field: keyof PromoteFormData, val: unknown) => {
      setPromoteForms((prev) =>
        prev.map((f, i) => (i === index ? { ...f, [field]: val } : f))
      )
    },
    []
  )

  const handlePromote = useCallback(async () => {
    setIsPromoting(true)
    const result = await promoteCandidatesAction(promoteForms)
    setIsPromoting(false)
    if (result.success) {
      setPromoteModalOpen(false)
      setSelectedIds([])
      refetch()
    } else {
      alert(`Ошибка: ${result.error}`)
    }
  }, [promoteForms, refetch])

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    try {
      const res = await fetch("/api/candidates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      })
      const result = await res.json()
      if (result.success) {
        setDeleteConfirmOpen(false)
        setSelectedIds([])
        refetch()
      } else {
        alert(`Ошибка: ${result.error}`)
      }
    } catch {
      alert("Ошибка при удалении")
    }
    setIsDeleting(false)
  }, [selectedIds, refetch])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 text-sm text-foreground flex-1 overflow-y-auto min-h-0">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Кандидаты в лексикон</h1>
        <p className="text-xs text-muted-foreground">
          Слова, предложенные для добавления в словарь. Проверьте и перенесите в основную таблицу.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/20 p-4 rounded-xl border shrink-0">
        <div className="w-full sm:flex-1 relative">
          <input
            type="text"
            placeholder="Поиск по value, isv или nsl..."
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
        <div className="flex gap-2 shrink-0">
          <button
            onClick={openPromoteModal}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50 transition-all shadow-sm"
          >
            Перенести в словарь ({selectedIds.length})
          </button>
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm"
          >
            Удалить ({selectedIds.length})
          </button>
        </div>
      </div>

      <div className="border rounded-xl bg-background shadow-sm overflow-x-auto max-w-full">
        <table className="w-full text-left border-collapse table-auto min-w-[700px]">
          <thead>
            <tr className="bg-muted text-xs font-semibold uppercase border-b">
              <th className="p-3 w-12 text-center select-none">
                <input
                  type="checkbox"
                  checked={allItems.length > 0 && selectedIds.length === allItems.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                />
              </th>
              <th className="p-3">Value</th>
              <th className="p-3">ISV</th>
              <th className="p-3">NSL</th>
              <th className="p-3">POS</th>
              <th className="p-3">Тип</th>
              <th className="p-3">Источник</th>
              <th className="p-3">Создан</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {allItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  {isLoading ? "Загрузка..." : "Нет кандидатов"}
                </td>
              </tr>
            ) : (
              allItems.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-muted/10 transition-colors">
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(candidate.id)}
                      onChange={() => toggleSelect(candidate.id)}
                      className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                    />
                  </td>
                  <td className="p-3 font-semibold whitespace-nowrap">
                    {candidate.value || "—"}
                  </td>
                  <td className="p-3 whitespace-nowrap text-blue-600">
                    {candidate.isv || "—"}
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {candidate.nsl || "—"}
                  </td>
                  <td className="p-3">{candidate.pos || "—"}</td>
                  <td className="p-3">{candidate.type || "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
                    {candidate.addition || "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(candidate.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div ref={loadMoreRef} className="py-4 text-center text-xs text-muted-foreground">
        {isFetchingNextPage ? "Загрузка..." : hasNextPage ? "Прокрутите для загрузки" : "Все кандидаты загружены"}
      </div>

      {promoteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden">
          <div className="bg-background border rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[85vh]">
            <div className="p-5 border-b flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold">Перенос в словарь</h3>
                <p className="text-xs text-muted-foreground">
                  Заполните поля для каждого кандидата. Slug будет сгенерирован как value-pos.
                </p>
              </div>
              <button
                onClick={() => setPromoteModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6 flex-1">
              {promoteForms.map((form, idx) => (
                <div
                  key={form.candidateId}
                  className="border rounded-xl p-4 space-y-3 bg-muted/10"
                >
                  <h4 className="font-semibold text-sm">
                    Кандидат #{idx + 1} (ID: {form.candidateId})
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Value</label>
                      <input
                        type="text"
                        className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                        value={form.value}
                        onChange={(e) => updateForm(idx, "value", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">POS</label>
                      <input
                        type="text"
                        className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                        value={form.pos}
                        onChange={(e) => updateForm(idx, "pos", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Base</label>
                      <input
                        type="text"
                        className="w-full px-3 py-1.5 border rounded-md bg-background"
                        value={form.base}
                        onChange={(e) => updateForm(idx, "base", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Gender</label>
                      <input
                        type="text"
                        className="w-full px-3 py-1.5 border rounded-md bg-background"
                        value={form.gender}
                        onChange={(e) => updateForm(idx, "gender", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Declension
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-1.5 border rounded-md bg-background"
                        value={form.declension ?? ""}
                        onChange={(e) =>
                          updateForm(
                            idx,
                            "declension",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Conjugation
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-1.5 border rounded-md bg-background"
                        value={form.conjugation ?? ""}
                        onChange={(e) =>
                          updateForm(
                            idx,
                            "conjugation",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Slug (авто): {form.value}-{form.pos}
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Корень (необязательно)
                    </label>
                    <input
                      type="text"
                      placeholder="Поиск корня..."
                      className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500 mb-1"
                      value={rootSearchQuery}
                      onChange={(e) => setRootSearchQuery(e.target.value)}
                    />
                    {rootResults && rootResults.length > 0 && (
                      <select
                        className="w-full px-3 py-1.5 border rounded-md bg-background"
                        value={form.rootId ?? ""}
                        onChange={(e) =>
                          updateForm(
                            idx,
                            "rootId",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      >
                        <option value="">— без корня —</option>
                        {rootResults.map((root) => (
                          <option key={root.id} value={root.id}>
                            {root.value}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t bg-muted/10 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setPromoteModalOpen(false)}
                className="px-4 py-2 border rounded-md text-xs font-semibold hover:bg-background transition-colors"
                disabled={isPromoting}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handlePromote}
                disabled={isPromoting}
                className="px-4 py-2 bg-green-600 text-white font-semibold text-xs rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isPromoting ? "Перенос..." : "Перенести в словарь"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-background border rounded-2xl w-full max-w-md shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold">Подтверждение удаления</h3>
            <p className="text-sm text-muted-foreground">
              Вы уверены, что хотите удалить {selectedIds.length} кандидат(ов)?
              Это действие нельзя отменить.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 border rounded-md text-xs font-semibold hover:bg-background transition-colors"
                disabled={isDeleting}
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white font-semibold text-xs rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isDeleting ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}