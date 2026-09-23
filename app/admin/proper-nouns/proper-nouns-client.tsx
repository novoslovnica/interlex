"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { ProperNounQueueItem } from "@/lib/community/properNounReview"
import { saveProperNounDecisionsAction } from "./actions"

export default function ProperNounsClient({ items }: { items: ProperNounQueueItem[] }) {
    const [checked, setChecked] = useState<Set<number>>(() => new Set(items.filter((item) => item.suggestedProper).map((item) => item.lexemeId)))
    const [message, setMessage] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    if (items.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Очередь пуста.</p>

    const toggle = (lexemeId: number) => setChecked((prev) => {
        const next = new Set(prev)
        if (next.has(lexemeId)) next.delete(lexemeId)
        else next.add(lexemeId)
        return next
    })

    const save = () => {
        const properCount = checked.size
        if (!confirm(`Сохранить: ${properCount} имён собственных, у остальных ${items.length - properCount} слов переводы будут переведены в строчные?`)) return
        setMessage(null)
        startTransition(async () => {
            const result = await saveProperNounDecisionsAction(items.map((item) => ({ lexemeId: item.lexemeId, proper: checked.has(item.lexemeId) })))
            setMessage(result.success ? `Готово: флаг у ${result.flagged}, переводов исправлено ${result.lowercased}.` : `Ошибка: ${result.error}`)
        })
    }

    const bar = (
        <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" onClick={save} disabled={pending} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
                Сохранить {items.length} решений
            </button>
            <span className="text-muted-foreground">отмечено как имена: {checked.size}</span>
            <button type="button" onClick={() => setChecked(new Set())} className="text-xs text-muted-foreground underline">снять все</button>
            {message && <span className="text-xs">{message}</span>}
        </div>
    )

    return (
        <div className="space-y-3">
            {bar}
            <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                    <tr><th className="py-1 w-8">имя</th><th>слово</th><th>переводы с заглавной</th><th className="whitespace-nowrap">сигналы</th></tr>
                </thead>
                <tbody>
                    {items.map((item) => {
                        const isProper = checked.has(item.lexemeId)
                        return (
                            <tr key={item.lexemeId} onClick={() => toggle(item.lexemeId)} className={`border-t cursor-pointer select-none ${isProper ? "bg-blue-500/10" : ""}`}>
                                <td className="py-1.5 align-top"><input type="checkbox" checked={isProper} readOnly className="h-4 w-4" /></td>
                                <td className="py-1.5 align-top whitespace-nowrap">
                                    <Link href={`/words/${item.lexemeId}`} target="_blank" onClick={(e) => e.stopPropagation()} className="font-semibold text-blue-600">{item.isv}</Link>
                                    {item.pos && <span className="text-xs text-muted-foreground ml-1">{item.pos}</span>}
                                </td>
                                <td className="py-1.5 align-top text-xs">
                                    {item.translations.map((t) => `${t.language}: ${t.value}`).join(" · ")}
                                </td>
                                <td className="py-1.5 align-top text-xs text-muted-foreground whitespace-nowrap">
                                    {item.refCapitalized && <span title="все вычитанные языки с заглавной">📚 </span>}
                                    {item.corpusMidTotal > 0 && <span title="с заглавной в середине предложения в корпусе">{item.corpusMidCap}/{item.corpusMidTotal}</span>}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            {bar}
        </div>
    )
}
