"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { SegmentView, ColorLegend, type SegmentResult } from "@/components/CorpusTokenDisplay"

interface SegmentItem {
  id: string
  position: number
  rawText: string
  sentenceCount: number
}

export default function CorpusSegmentsPage({
  document,
  segments,
  currentPage,
  totalPages,
  query,
}: {
  document: { title: string; slug: string }
  segments: SegmentItem[]
  currentPage: number
  totalPages: number
  query: string
}) {
  const router = useRouter()
  const [selectedPos, setSelectedPos] = useState<number | null>(null)
  const [segmentData, setSegmentData] = useState<SegmentResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState(query)
  const [jumpPage, setJumpPage] = useState("")

  const fetchSegment = useCallback(async (position: number) => {
    setLoading(true)
    setSegmentData(null)
    try {
      const res = await fetch(
        `/api/admin/corpus/documents/${document.slug}/segments/${position}`,
      )
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setSegmentData(data.segment)
    } catch {
      setSegmentData(null)
    } finally {
      setLoading(false)
    }
  }, [document.slug])

  useEffect(() => {
    if (selectedPos !== null) {
      fetchSegment(selectedPos)
    }
  }, [selectedPos, fetchSegment])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (searchText.trim()) params.set("q", searchText.trim())
    params.set("page", "1")
    router.push(`/admin/corpus/documents/${document.slug}/segments?${params}`)
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    params.set("page", String(page))
    router.push(`/admin/corpus/documents/${document.slug}/segments?${params}`)
  }

  function handleJumpPage(e: React.FormEvent) {
    e.preventDefault()
    const page = parseInt(jumpPage, 10)
    if (!isNaN(page)) goToPage(page)
    setJumpPage("")
  }

  const previewText = (raw: string, maxLen = 120) => {
    if (raw.length <= maxLen) return raw
    return raw.slice(0, maxLen) + "…"
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background text-foreground">
      <div className="flex items-center gap-3 px-6 py-3 border-b">
        <Link
          href={`/admin/corpus/documents/${document.slug}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ←
        </Link>
        <h1 className="text-lg font-semibold">{document.title}</h1>
        <span className="text-sm text-muted-foreground">— сегменты</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: segment list */}
        <div className="w-[380px] min-w-[320px] border-r flex flex-col min-h-0">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="p-3 border-b">
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Поиск по тексту абзацев…"
                className="w-full px-3 py-1.5 text-sm rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchText("")
                    router.push(`/admin/corpus/documents/${document.slug}/segments`)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
                >
                  ✕
                </button>
              )}
            </div>
          </form>

          {/* Segment list */}
          <div className="flex-1 overflow-y-auto">
            {segments.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                {query ? "Ничего не найдено" : "Нет сегментов"}
              </div>
            ) : (
              segments.map((seg) => (
                <button
                  key={seg.id}
                  onClick={() => setSelectedPos(seg.position)}
                  className={`w-full text-left p-3 border-b hover:bg-muted/20 transition-colors ${
                    selectedPos === seg.position ? "bg-muted/30 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      #{seg.position + 1}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {seg.sentenceCount} пр.
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed line-clamp-3">
                    {previewText(seg.rawText)}
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t p-3 flex items-center justify-between gap-2 text-sm">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-2 py-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ←
              </button>

              <div className="flex items-center gap-1 overflow-x-auto">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - currentPage) <= 2,
                  )
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-muted-foreground">…</span>
                      )}
                      <button
                        onClick={() => goToPage(p)}
                        className={`px-2 py-1 rounded transition-colors ${
                          p === currentPage
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
              </div>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                →
              </button>

              <form onSubmit={handleJumpPage} className="flex items-center gap-1 ml-2">
                <input
                  type="text"
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                  placeholder="№"
                  className="w-12 px-1.5 py-1 text-xs rounded border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </form>
            </div>
          )}
        </div>

        {/* Right panel: token view */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedPos === null ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Выберите абзац слева для просмотра разбора токенов
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm animate-pulse">
              Загрузка…
            </div>
          ) : segmentData ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Абзац #{selectedPos + 1} — {segmentData.sentences.length} предложений,{" "}
                  {segmentData.sentences.reduce((s, sen) => s + sen.tokens.length, 0)} токенов
                </h2>
                <ColorLegend />
              </div>
              <SegmentView segments={[segmentData]} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-red-500 text-sm">
              Ошибка загрузки токенов
            </div>
          )}
        </div>
      </div>
    </div>
  )
}