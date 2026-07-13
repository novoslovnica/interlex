"use client"

import { useState, useTransition, useEffect, useRef } from "react"

interface RelationInfo {
  id: number
  targetMeaningId: number
  targetMeaning: string | null
  targetWordId: number
  targetWord: string | null
}

interface MeaningRelations {
  id: number
  meaning: string | null
  relations: Record<string, RelationInfo[]>
}

interface RelationsTabProps {
  wordId: number
  wordValue: string | null
  meanings: MeaningRelations[]
}

const RELATION_TYPES = [
  { key: "synonyms", label: "Синонимы", color: "text-blue-600", bg: "bg-blue-500/5", border: "border-blue-500/20" },
  { key: "antonyms", label: "Антонимы", color: "text-red-600", bg: "bg-red-500/5", border: "border-red-500/20" },
  { key: "hypernyms", label: "Гиперонимы", color: "text-blue-600", bg: "bg-blue-500/5", border: "border-blue-500/20" },
  { key: "hyponyms", label: "Гипонимы", color: "text-purple-600", bg: "bg-purple-500/5", border: "border-purple-500/20" },
  { key: "meronyms", label: "Меронимы", color: "text-green-600", bg: "bg-green-500/5", border: "border-green-500/20" },
  { key: "holonyms", label: "Холонимы", color: "text-orange-600", bg: "bg-orange-500/5", border: "border-orange-500/20" },
  { key: "related-words", label: "Связанные", color: "text-slate-600", bg: "bg-slate-500/5", border: "border-slate-500/20" },
  { key: "causes", label: "Причины", color: "text-amber-600", bg: "bg-amber-500/5", border: "border-amber-500/20" },
  { key: "effects", label: "Следствия", color: "text-rose-600", bg: "bg-rose-500/5", border: "border-rose-500/20" },
  { key: "premises", label: "Предпосылки", color: "text-teal-600", bg: "bg-teal-500/5", border: "border-teal-500/20" },
  { key: "conclusions", label: "Заключения", color: "text-indigo-600", bg: "bg-indigo-500/5", border: "border-indigo-500/20" },
] as const

type RelationKey = typeof RELATION_TYPES[number]["key"]

interface SearchResult {
  id: number
  meaning: string | null
  word: { id: number; value: string | null }
}

function meaningDisplay(m: { targetWord: string | null; targetMeaning: string | null }): string {
  return m.targetMeaning
    ? `${m.targetWord || `ID`} — ${m.targetMeaning}`
    : (m.targetWord || `ID`)
}

function searchResultDisplay(r: SearchResult): string {
  const word = r.word.value || `ID: ${r.word.id}`
  return r.meaning ? `${word} — ${r.meaning}` : word
}

export function RelationsTab({ wordId, wordValue, meanings }: RelationsTabProps) {
  const [selectedMeaningId, setSelectedMeaningId] = useState<number>(meanings[0]?.id ?? 0)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()

  const [localRelations, setLocalRelations] = useState<Record<string, RelationInfo[]>>({})

  const currentMeaning = meanings.find(m => m.id === selectedMeaningId)

  useEffect(() => {
    if (currentMeaning) {
      const init: Record<string, RelationInfo[]> = {}
      for (const rt of RELATION_TYPES) {
        init[rt.key] = currentMeaning.relations[rt.key] ?? []
      }
      setLocalRelations(init)
    }
  }, [selectedMeaningId, currentMeaning])

  const isAttached = (typeKey: string, meaningId: number) => {
    return (localRelations[typeKey] ?? []).some(r => r.targetMeaningId === meaningId)
  }

  const toggleRelation = (typeKey: string, result: SearchResult) => {
    const current = localRelations[typeKey] ?? []
    const exists = current.some(r => r.targetMeaningId === result.id)
    if (exists) {
      setLocalRelations(prev => ({ ...prev, [typeKey]: current.filter(r => r.targetMeaningId !== result.id) }))
    } else {
      setLocalRelations(prev => ({
        ...prev,
        [typeKey]: [...current, {
          id: 0,
          targetMeaningId: result.id,
          targetMeaning: result.meaning,
          targetWordId: result.word.id,
          targetWord: result.word.value,
        }],
      }))
    }
  }

  const removeRelation = (typeKey: string, relation: RelationInfo) => {
    setLocalRelations(prev => ({
      ...prev,
      [typeKey]: (prev[typeKey] ?? []).filter(r => r.targetMeaningId !== relation.targetMeaningId),
    }))
  }

  const handleSave = (typeKey: string) => {
    startTransition(async () => {
      setSaving(prev => ({ ...prev, [typeKey]: true }))
      try {
        const res = await fetch(`/api/word-relations/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: typeKey,
            sourceMeaningId: selectedMeaningId,
            targetMeaningIds: (localRelations[typeKey] ?? []).map(r => r.targetMeaningId),
          }),
        })
        if (!res.ok) {
          alert("Ошибка при сохранении")
        }
      } catch {
        alert("Ошибка при сохранении")
      } finally {
        setSaving(prev => ({ ...prev, [typeKey]: false }))
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Управление отношениями</h2>
        <p className="text-sm text-muted-foreground">
          Слово: <span className="font-semibold text-foreground">{wordValue}</span> (ID: {wordId})
        </p>
      </div>

      {meanings.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider self-center">
            Значения:
          </span>
          {meanings.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMeaningId(m.id)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                m.id === selectedMeaningId
                  ? "bg-primary/10 border-primary text-primary font-semibold"
                  : "bg-background border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {m.meaning || `Значение #${m.id}`}
            </button>
          ))}
        </div>
      )}

      {currentMeaning && (
        <div className="text-sm text-muted-foreground pb-2 border-b">
          Текущее значение: <span className="font-semibold text-foreground">{currentMeaning.meaning || `Значение #${currentMeaning.id}`}</span>
        </div>
      )}

      {RELATION_TYPES.map(rt => (
        <RelationSection
          key={rt.key}
          config={rt}
          relations={localRelations[rt.key] ?? []}
          isSaving={saving[rt.key] ?? false}
          selectedMeaningId={selectedMeaningId}
          onToggle={(result) => toggleRelation(rt.key, result)}
          onRemove={(rel) => removeRelation(rt.key, rel)}
          onSave={() => handleSave(rt.key)}
        />
      ))}
    </div>
  )
}

function RelationSection({
  config,
  relations,
  isSaving,
  selectedMeaningId,
  onToggle,
  onRemove,
  onSave,
}: {
  config: typeof RELATION_TYPES[number]
  relations: RelationInfo[]
  isSaving: boolean
  selectedMeaningId: number
  onToggle: (r: SearchResult) => void
  onRemove: (r: RelationInfo) => void
  onSave: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const q = searchQuery.trim()
    if (!q) {
      setSearchResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/meanings/search?query=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.filter((m: SearchResult) => m.id !== selectedMeaningId))
        }
      } catch {
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, selectedMeaningId])

  return (
    <div className={`border rounded-lg ${config.border}`}>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold ${config.color} ${config.bg} hover:opacity-80 transition-opacity`}
      >
        <span>{config.label}</span>
        <svg className={`w-3 h-3 transition-transform ${collapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {/* Current relations */}
          <div className="flex flex-wrap gap-1.5 min-h-[32px]">
            {relations.length > 0 ? (
              relations.map(rel => (
                <span
                  key={`${rel.targetMeaningId}-${rel.targetWordId}`}
                  className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${config.bg} ${config.color} ${config.border} border`}
                >
                  {meaningDisplay(rel)}
                  <button
                    type="button"
                    onClick={() => onRemove(rel)}
                    className="ml-1.5 hover:text-destructive font-bold"
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground italic">Нет связей</span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Поиск ${config.label.toLowerCase()}...`}
                className="flex-1 px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary outline-none"
              />
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors shadow-sm ${config.color} ${config.bg} border ${config.border} hover:opacity-80 disabled:opacity-50`}
              >
                {isSaving ? "..." : "Сохранить"}
              </button>
            </div>

            {searchQuery.trim() && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 border rounded-lg bg-background shadow-md max-h-[160px] overflow-y-auto z-10 p-1 space-y-0.5">
                {searchResults.map(r => (
                  <div
                    key={`res-${r.id}`}
                    onClick={() => onToggle(r)}
                    className="p-2 text-xs hover:bg-primary/10 rounded cursor-pointer transition-colors flex justify-between"
                  >
                    <span className="font-medium">{searchResultDisplay(r)}</span>
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {relations.some(rel => rel.targetMeaningId === r.id) ? "✓" : "+"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {isSearching && (
              <span className="text-[10px] text-muted-foreground animate-pulse mt-1 block">Поиск...</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export type { RelationInfo, MeaningRelations }