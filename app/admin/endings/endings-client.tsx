"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"

interface EndingAllophoneItem {
  id: number
  stemType: string
  grammeme: string
  value: string
  flavor: { id: number; code: string }
}

const STEM_TYPES = [
  "o_hard", "o_soft", "a_hard", "a_soft",
  "u_basis", "i_basis", "consonant_n", "consonant_s",
]

const GRAMMEMES = [
  "SgNom", "SgAcc", "SgGen", "SgDat", "SgIns", "SgLoc", "SgVoc",
  "PlNom", "PlAcc", "PlGen", "PlDat", "PlIns", "PlLoc", "PlVoc",
  "DuNom", "DuAcc", "DuGen", "DuDat", "DuIns", "DuLoc",
]

const FLAVOR_LABELS: Record<string, string> = {
  CORE: "CORE (ISV)",
  NSL: "NSL",
  EAST: "EAST",
  WEST: "WEST",
  SOUTH: "SOUTH",
}

const FLAVOR_OPTIONS = ["CORE", "NSL", "EAST", "WEST", "SOUTH"] as const

export default function EndingsClient() {
  const [items, setItems] = useState<EndingAllophoneItem[]>([])
  const [loading, setLoading] = useState(true)
  const [stemTypeFilter, setStemTypeFilter] = useState("")
  const [error, setError] = useState("")
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [editItem, setEditItem] = useState<EndingAllophoneItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const prevFilter = useRef(stemTypeFilter)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (stemTypeFilter.trim()) params.set("stemType", stemTypeFilter)
      const res = await fetch(`/api/endings?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setItems(data.items)
    } catch {
      setError("Ошибка загрузки")
    }
    setLoading(false)
  }, [stemTypeFilter])

  useEffect(() => {
    if (prevFilter.current !== stemTypeFilter) {
      prevFilter.current = stemTypeFilter
    }
    fetchItems()
  }, [fetchItems])

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/endings/${id}`, { method: "DELETE" })
      if (res.ok) {
        setDeleteConfirmId(null)
        fetchItems()
      } else {
        alert("Ошибка при удалении")
      }
    } catch {
      alert("Ошибка при удалении")
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 text-sm text-foreground flex-1 overflow-y-auto min-h-0">
      <div className="border-b pb-4 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Окончания (флексии)</h1>
          <p className="text-xs text-muted-foreground">
            Управление окончаниями для всех типов основ и граммем.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-all shadow-sm"
        >
          + Создать
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/20 p-4 rounded-xl border shrink-0">
        <div className="w-full sm:w-64">
          <select
            className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={stemTypeFilter}
            onChange={(e) => setStemTypeFilter(e.target.value)}
          >
            <option value="">Все типы основ</option>
            {STEM_TYPES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-auto max-h-[600px] border rounded-xl bg-background shadow-sm overflow-x-auto max-w-full">
        <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
          <thead>
            <tr className="bg-muted text-xs font-semibold uppercase border-b">
              <th className="p-3">ID</th>
              <th className="p-3">Тип основы</th>
              <th className="p-3">Граммема</th>
              <th className="p-3">Вариант</th>
              <th className="p-3">Окончание</th>
              <th className="p-3 w-24">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">Загрузка...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-red-500">{error}</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">Нет записей</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                  <td className="p-3 text-muted-foreground">{item.id}</td>
                  <td className="p-3 font-mono text-xs">{item.stemType}</td>
                  <td className="p-3 font-mono text-xs">{item.grammeme}</td>
                  <td className="p-3">{FLAVOR_LABELS[item.flavor.code] || item.flavor.code}</td>
                  <td className="p-3 font-semibold">{item.value}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditItem(item)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Править
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(item.id)}
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

      {editItem && (
        <EditEndingModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); fetchItems() }}
        />
      )}

      {createOpen && (
        <CreateEndingModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); fetchItems() }}
        />
      )}

      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-background border rounded-2xl w-full max-w-md shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold">Подтверждение удаления</h3>
            <p className="text-sm text-muted-foreground">
              Вы уверены, что хотите удалить запись ID: {deleteConfirmId}?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 border rounded-md text-xs font-semibold hover:bg-background transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 text-white font-semibold text-xs rounded-md hover:bg-red-700"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditEndingModal({
  item,
  onClose,
  onSaved,
}: {
  item: EndingAllophoneItem
  onClose: () => void
  onSaved: () => void
}) {
  const [value, setValue] = useState(item.value)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!value.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/endings/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: value.trim() }),
      })
      if (res.ok) onSaved()
      else alert("Ошибка при сохранении")
    } catch {
      alert("Ошибка при сохранении")
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-background border rounded-2xl w-full max-w-md shadow-xl p-6 space-y-4">
        <h3 className="text-base font-bold">Редактирование окончания</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div><span className="font-semibold">Тип основы:</span> {item.stemType}</div>
            <div><span className="font-semibold">Граммема:</span> {item.grammeme}</div>
            <div><span className="font-semibold">Вариант:</span> {FLAVOR_LABELS[item.flavor.code] || item.flavor.code}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Окончание</label>
            <input
              type="text"
              className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md text-xs font-semibold hover:bg-background transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateEndingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [stemType, setStemType] = useState("o_hard")
  const [grammeme, setGrammeme] = useState("SgNom")
  const [flavorCode, setFlavorCode] = useState<string>("CORE")
  const [value, setValue] = useState("")
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!value.trim()) {
      alert("Введите окончание")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/endings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stemType, grammeme, flavorCode, value }),
      })
      if (res.ok) onCreated()
      else {
        const data = await res.json()
        alert(`Ошибка: ${data.error}`)
      }
    } catch {
      alert("Ошибка при создании")
    }
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden">
      <div className="bg-background border rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[85vh]">
        <div className="p-5 border-b shrink-0">
          <h3 className="text-base font-bold">Создание окончания</h3>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Тип основы</label>
              <select
                className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                value={stemType}
                onChange={(e) => setStemType(e.target.value)}
              >
                {STEM_TYPES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Граммема</label>
              <select
                className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                value={grammeme}
                onChange={(e) => setGrammeme(e.target.value)}
              >
                {GRAMMEMES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Вариант</label>
              <select
                className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                value={flavorCode}
                onChange={(e) => setFlavorCode(e.target.value)}
              >
                {FLAVOR_OPTIONS.map((code) => (
                  <option key={code} value={code}>{FLAVOR_LABELS[code]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Окончание</label>
              <input
                type="text"
                className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="ъ, a, u, omъ..."
              />
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
            onClick={handleCreate}
            disabled={creating || !value.trim()}
            className="px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? "Создание..." : "Создать"}
          </button>
        </div>
      </div>
    </div>
  )
}