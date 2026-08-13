"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

interface ApiKeyAdminRow {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: Date | null
  requestCount: number
  createdAt: Date
  revokedAt: Date | null
  rateLimitOverride: number | null
  userId: string
  userEmail: string | null
}

function formatDate(value: Date | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString("ru-RU")
}

function KeyRow({
  keyRow,
  setOverride,
  revoke,
}: {
  keyRow: ApiKeyAdminRow
  setOverride: (formData: FormData) => Promise<void>
  revoke: (formData: FormData) => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()
  const [override, setOverrideValue] = useState(keyRow.rateLimitOverride?.toString() ?? "")
  const router = useRouter()

  const handleSaveOverride = () => {
    const formData = new FormData()
    formData.set("id", keyRow.id)
    formData.set("rateLimitOverride", override)
    startTransition(async () => {
      await setOverride(formData)
      router.refresh()
    })
  }

  const handleRevoke = () => {
    if (!confirm(`Отозвать ключ "${keyRow.name}"?`)) return
    const formData = new FormData()
    formData.set("id", keyRow.id)
    startTransition(async () => {
      await revoke(formData)
      router.refresh()
    })
  }

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate" title={keyRow.userEmail || keyRow.userId}>
        {keyRow.userEmail || keyRow.userId}
      </td>
      <td className="px-3 py-2 font-medium">{keyRow.name}</td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{keyRow.keyPrefix}…</td>
      <td className="px-3 py-2 text-right text-muted-foreground">{keyRow.requestCount}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(keyRow.lastUsedAt)}</td>
      <td className="px-3 py-2">
        {keyRow.revokedAt ? (
          <span className="text-xs text-destructive">Отозван</span>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              placeholder="дефолт"
              value={override}
              onChange={(e) => setOverrideValue(e.target.value)}
              className="w-20 px-2 py-1 text-xs rounded border bg-background"
            />
            <button
              onClick={handleSaveOverride}
              disabled={isPending}
              className="px-2 py-1 text-xs rounded border hover:bg-muted transition-colors disabled:opacity-50"
            >
              OK
            </button>
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {!keyRow.revokedAt && (
          <button
            onClick={handleRevoke}
            disabled={isPending}
            className="px-2 py-1 text-xs rounded border text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
          >
            Отозвать
          </button>
        )}
      </td>
    </tr>
  )
}

export function ApiKeysAdminClient({
  keys,
  setOverride,
  revoke,
}: {
  keys: ApiKeyAdminRow[]
  setOverride: (formData: FormData) => Promise<void>
  revoke: (formData: FormData) => Promise<void>
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Пользователь</th>
            <th className="text-left px-3 py-2 font-medium">Название</th>
            <th className="text-left px-3 py-2 font-medium">Ключ</th>
            <th className="text-right px-3 py-2 font-medium">Запросов всего</th>
            <th className="text-left px-3 py-2 font-medium">Последнее использование</th>
            <th className="text-left px-3 py-2 font-medium">Свой лимит (/мин)</th>
            <th className="text-right px-3 py-2 font-medium">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {keys.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-sm">
                Пока никто не создал API-ключ
              </td>
            </tr>
          )}
          {keys.map((k) => (
            <KeyRow key={k.id} keyRow={k} setOverride={setOverride} revoke={revoke} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
