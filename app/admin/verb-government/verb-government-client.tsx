"use client"

import React, { useState, useEffect, useCallback } from "react"

interface VerbGovernmentItem {
  id: number
  verbLemma: string
  reflexive: boolean
  requiredCase: string
  role: string
  priority: number
  note: string | null
}

const CASES = ["nom", "gen", "dat", "acc", "ins", "loc", "voc"]
const ROLES = ["obj", "iobj", "obl"] as const

const ROLE_LABELS: Record<string, string> = {
  obj: "obj — прямое дополнение",
  iobj: "iobj — косвенное дополнение",
  obl: "obl — обстоятельство",
}

export default function VerbGovernmentClient() {
  const [items, setItems] = useState<VerbGovernmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [verbLemmaFilter, setVerbLemmaFilter] = useState("")
  const [error, setError] = useState("")
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [editItem, setEditItem] = useState<VerbGovernmentItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (verbLemmaFilter.trim()) params.set("verbLemma", verbLemmaFilter.trim())
      const res = await fetch(`/api/admin/verb-government?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setItems(data.items)
    } catch {
      setError("Ошибка загрузки")
    }
    setLoading(false)
  }, [verbLemmaFilter])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/verb-government/${id}`, { method: "DELETE" })
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
          <h1 className="text-2xl font-bold tracking-tight">Управление глаголов</h1>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Падеж, которым глагол управляет своё дополнение (напр. «pomagati» + Dat).
            Питает дизамбигуацию омонимов по синтаксису (Pass C) и разметку клаузных
            ролей в синтаксис-парсере — намеренно пусто до ручного ввода, ни один
            факт не выдумывается скриптом.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-all shadow-sm shrink-0"
        >
          + Создать
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/20 p-4 rounded-xl border shrink-0">
        <div className="w-full sm:w-64">
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Поиск по лемме глагола…"
            value={verbLemmaFilter}
            onChange={(e) => setVerbLemmaFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-auto max-h-[600px] border rounded-xl bg-background shadow-sm overflow-x-auto max-w-full">
        <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
          <thead>
            <tr className="bg-muted text-xs font-semibold uppercase border-b">
              <th className="p-3">ID</th>
              <th className="p-3">Глагол</th>
              <th className="p-3">se/sę</th>
              <th className="p-3">Падеж</th>
              <th className="p-3">Роль</th>
              <th className="p-3">Приоритет</th>
              <th className="p-3">Заметка</th>
              <th className="p-3 w-24">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">Загрузка...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-red-500">{error}</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">Нет записей</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                  <td className="p-3 text-muted-foreground">{item.id}</td>
                  <td className="p-3 font-mono text-xs font-semibold">{item.verbLemma}</td>
                  <td className="p-3 text-xs">{item.reflexive ? "se" : "—"}</td>
                  <td className="p-3 font-mono text-xs">{item.requiredCase}</td>
                  <td className="p-3 text-xs">{ROLE_LABELS[item.role] ?? item.role}</td>
                  <td className="p-3 text-xs">{item.priority}</td>
                  <td className="p-3 text-xs text-muted-foreground truncate max-w-[200px]" title={item.note ?? ""}>{item.note || "—"}</td>
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
        <EditVerbGovernmentModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); fetchItems() }}
        />
      )}

      {createOpen && (
        <CreateVerbGovernmentModal
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

function EditVerbGovernmentModal({
  item,
  onClose,
  onSaved,
}: {
  item: VerbGovernmentItem
  onClose: () => void
  onSaved: () => void
}) {
  const [role, setRole] = useState(item.role)
  const [priority, setPriority] = useState(item.priority)
  const [note, setNote] = useState(item.note ?? "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/verb-government/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, priority, note: note.trim() || null }),
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
        <h3 className="text-base font-bold">Редактирование управления</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div><span className="font-semibold">Глагол:</span> {item.verbLemma}</div>
            <div><span className="font-semibold">se/sę:</span> {item.reflexive ? "да" : "нет"}</div>
            <div><span className="font-semibold">Падеж:</span> {item.requiredCase}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Роль</label>
            <select
              className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Приоритет (меньше — предпочтительнее)</label>
            <input
              type="number"
              className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Заметка</label>
            <input
              type="text"
              className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Опционально"
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
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateVerbGovernmentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [verbLemma, setVerbLemma] = useState("")
  const [reflexive, setReflexive] = useState(false)
  const [requiredCase, setRequiredCase] = useState("acc")
  const [role, setRole] = useState<string>("obj")
  const [priority, setPriority] = useState(0)
  const [note, setNote] = useState("")
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!verbLemma.trim()) {
      alert("Введите лемму глагола")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/admin/verb-government", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verbLemma, reflexive, requiredCase, role, priority, note: note.trim() || null }),
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
          <h3 className="text-base font-bold">Добавить управление глагола</h3>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Лемма глагола</label>
              <input
                type="text"
                className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                value={verbLemma}
                onChange={(e) => setVerbLemma(e.target.value)}
                placeholder="pomagati"
                autoFocus
              />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={reflexive}
                  onChange={(e) => setReflexive(e.target.checked)}
                />
                Возвратный (se/sę)
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Падеж</label>
              <select
                className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                value={requiredCase}
                onChange={(e) => setRequiredCase(e.target.value)}
              >
                {CASES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Роль</label>
              <select
                className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Приоритет</label>
              <input
                type="number"
                className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Заметка</label>
              <input
                type="text"
                className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Опционально"
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
            disabled={creating || !verbLemma.trim()}
            className="px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? "Создание..." : "Создать"}
          </button>
        </div>
      </div>
    </div>
  )
}
