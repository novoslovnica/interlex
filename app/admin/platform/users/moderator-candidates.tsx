"use client"

import { useState, useTransition } from "react"
import { TRANSLATION_LANGUAGES } from "@/config/features"

export interface ModeratorCandidateView {
    userId: string
    label: string
    language: string
    votesResolved: number
    accuracy: number
    controlTotal: number
    controlCorrect: number
    alreadyModerator: boolean
}

// Блок "кандидаты в модераторы" на /admin/platform/users: участники, у
// которых по языку набрана статистика выше порогов (lib/community/publicStats.ts).
// Кнопка выдаёт роль и права; решение всегда за админом.
export function ModeratorCandidates({ candidates, onPromote }: {
    candidates: ModeratorCandidateView[]
    onPromote: (userId: string, language: string) => Promise<void>
}) {
    const [done, setDone] = useState<Set<string>>(new Set())
    const [pending, startTransition] = useTransition()
    if (candidates.length === 0) return null
    const languageName = (code: string) => TRANSLATION_LANGUAGES.find((lang) => lang.code === code)?.name ?? code

    return (
        <div className="px-4 md:px-6 pb-4">
            <div className="border rounded-xl bg-background p-4 border-border/60 space-y-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Кандидаты в модераторы</h2>
                <p className="text-xs text-muted-foreground">
                    ≥200 оценённых ответов по языку с точностью ≥90% и ≥90% верных контрольных. Кнопка даёт роль MODERATOR и права
                    на переводы этого языка и на разбор ответов сообщества. Остальные права — вручную ниже.
                </p>
                <table className="w-full text-sm">
                    <tbody>
                        {candidates.map((c) => {
                            const key = `${c.userId}:${c.language}`
                            return (
                                <tr key={key} className="border-t">
                                    <td className="py-1">{c.label}</td>
                                    <td>{languageName(c.language)}</td>
                                    <td className="text-muted-foreground">{c.votesResolved} · {Math.round(c.accuracy * 100)}% · контр. {c.controlCorrect}/{c.controlTotal}</td>
                                    <td className="text-right">
                                        {c.alreadyModerator || done.has(key) ? (
                                            <span className="text-xs text-green-600">права выданы</span>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={pending}
                                                onClick={() => startTransition(async () => {
                                                    if (!confirm(`Сделать ${c.label} модератором переводов (${languageName(c.language)})?`)) return
                                                    await onPromote(c.userId, c.language)
                                                    setDone((prev) => new Set(prev).add(key))
                                                })}
                                                className="text-xs px-2 py-1 rounded border border-blue-600 text-blue-600 disabled:opacity-50"
                                            >
                                                Выдать права
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
