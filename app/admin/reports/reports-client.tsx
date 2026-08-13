"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { resolveReportAction, dismissReportAction } from "./actions"

export interface ReportDTO {
  id: number
  createdAt: string
  entityType: string
  entityId: number
  lexemeId: number
  lexemeValue: string | null
  field: string | null
  reportedValue: string | null
  reasonCode: string
  comment: string | null
  submitter: string | null
}

const REASON_LABEL: Record<string, string> = {
  wrong_translation: "Неверный перевод",
  wrong_meaning: "Неверное значение",
  typo: "Опечатка",
  grammar: "Грамматическая ошибка",
  other: "Другое",
}

function ReportCard({ report }: { report: ReportDTO }) {
  const [isPending, startTransition] = useTransition()
  const [note, setNote] = useState("")
  const [hidden, setHidden] = useState(false)
  const router = useRouter()

  const handleResolve = () => {
    startTransition(async () => {
      const result = await resolveReportAction(report.id, note || undefined)
      if (result.success) {
        setHidden(true)
        router.refresh()
      } else {
        alert(`Ошибка: ${result.error}`)
      }
    })
  }

  const handleDismiss = () => {
    startTransition(async () => {
      const result = await dismissReportAction(report.id, note || undefined)
      if (result.success) {
        setHidden(true)
        router.refresh()
      } else {
        alert(`Ошибка: ${result.error}`)
      }
    })
  }

  if (hidden) return null

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <Link href={`/words/${report.lexemeId}`} target="_blank" className="text-lg font-bold hover:underline">
            {report.lexemeValue ?? `#${report.lexemeId}`}
          </Link>
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{report.entityType}{report.field ? `.${report.field}` : ""}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
            {REASON_LABEL[report.reasonCode] ?? report.reasonCode}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString("ru-RU")}</span>
      </div>

      {report.reportedValue && (
        <div className="text-sm text-muted-foreground">
          Было: <span className="italic">«{report.reportedValue}»</span>
        </div>
      )}
      {report.comment && <div className="text-sm">{report.comment}</div>}
      {report.submitter && <div className="text-xs text-muted-foreground">От: {report.submitter}</div>}

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Заметка модератора (необязательно)"
        className="w-full px-2 py-1.5 text-xs rounded border bg-background"
      />

      <div className="flex items-center gap-2">
        <Link
          href={`/admin/words/${report.lexemeId}/edit`}
          target="_blank"
          className="px-3 py-1 text-xs font-medium rounded border hover:bg-muted transition-colors"
        >
          Открыть в редакторе
        </Link>
        <button
          onClick={handleResolve}
          disabled={isPending}
          className="px-3 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "..." : "Решено"}
        </button>
        <button
          onClick={handleDismiss}
          disabled={isPending}
          className="px-3 py-1 text-xs font-medium rounded border hover:bg-muted transition-colors disabled:opacity-50"
        >
          Отклонить
        </button>
      </div>
    </div>
  )
}

export default function ReportsClient({
  reports,
  page,
  totalPages,
  total,
}: {
  reports: ReportDTO[]
  page: number
  totalPages: number
  total: number
}) {
  return (
    <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Жалобы на ошибки</h1>
        <span className="text-sm text-muted-foreground">В очереди: {total}</span>
      </div>

      {reports.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">Нет ожидающих жалоб</p>
      )}

      <div className="space-y-3">
        {reports.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Страница {page} из {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/reports?page=${page - 1}`} className="px-2 py-1 rounded border hover:bg-muted transition-colors">← Назад</Link>
            )}
            {page < totalPages && (
              <Link href={`/admin/reports?page=${page + 1}`} className="px-2 py-1 rounded border hover:bg-muted transition-colors">Вперёд →</Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
