"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { ReviewItem, ReviewAction } from "@/lib/community/moderatorReview"
import { resolveReviewAction } from "./actions"

interface CommunityReviewClientProps {
    items: ReviewItem[]
    userLabels: Record<string, string>
    writable: Record<string, boolean>
}

const VERDICT_LABEL: Record<string, string> = { yes: "верно", no: "неверно", unknown: "не знаю" }
const VERDICT_CLASS: Record<string, string> = { yes: "text-green-700", no: "text-red-700", unknown: "text-muted-foreground" }
const BUTTON = "px-3 py-1.5 rounded-lg text-sm font-medium border disabled:opacity-50"

export default function CommunityReviewClient({ items, userLabels, writable }: CommunityReviewClientProps) {
    if (items.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Очередь пуста.</p>
    return (
        <div className="space-y-3">
            {items.map((item) => (
                <ReviewCard key={item.translationId} item={item} userLabels={userLabels} canWrite={Boolean(writable[item.language])} />
            ))}
        </div>
    )
}

function ReviewCard({ item, userLabels, canWrite }: { item: ReviewItem; userLabels: Record<string, string>; canWrite: boolean }) {
    const [replacement, setReplacement] = useState(item.suggestions[0]?.value ?? "")
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    const run = (action: ReviewAction) => {
        if (action.kind === "clear" && !confirm(`Очистить перевод «${item.value}»? Прежнее значение останется в журнале аудита.`)) return
        setError(null)
        startTransition(async () => {
            const result = await resolveReviewAction(item.translationId, item.language, action)
            if (!result.success) setError(result.error === "not_in_queue" ? "Уже решено другим модератором — обновите страницу." : (result.error ?? "Ошибка"))
        })
    }

    return (
        <div className="border rounded-xl bg-background p-4 shadow-sm border-border/60 space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link href={`/words/${item.lexemeId}`} target="_blank" className="text-lg font-bold text-blue-600">{item.isv}</Link>
                {item.pos && <span className="text-xs text-muted-foreground">{item.pos}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${item.communityStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                    {item.communityStatus === "rejected" ? "отклонён" : "спорный"} · {item.communityYes} за / {item.communityNo} против
                </span>
                <Link href={`/admin/words/${item.lexemeId}/edit`} target="_blank" className="text-xs text-muted-foreground ml-auto">редактор слова ↗</Link>
            </div>
            {item.meaningText && <p className="text-sm text-muted-foreground">{item.meaningText}</p>}
            {(item.context.ru || item.context.en) && (
                <p className="text-xs text-muted-foreground">
                    {[item.context.ru && `RU: ${item.context.ru}`, item.context.en && `EN: ${item.context.en}`].filter(Boolean).join(" · ")}
                </p>
            )}

            <div className="rounded-lg bg-muted/40 px-3 py-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.language}</span>
                <div className="text-base font-semibold break-words">{item.value}</div>
            </div>

            <ul className="text-xs space-y-0.5">
                {item.votes.map((vote, index) => (
                    <li key={index} className="flex flex-wrap gap-x-2">
                        <span className={`font-medium ${VERDICT_CLASS[vote.verdict] ?? ""}`}>{VERDICT_LABEL[vote.verdict] ?? vote.verdict}</span>
                        <span className="text-muted-foreground">{userLabels[vote.userId] ?? vote.userId} · вес {vote.weight}</span>
                        {vote.suggestedValue && <span>→ «{vote.suggestedValue}»</span>}
                        {vote.comment && <span className="italic">{vote.comment}</span>}
                    </li>
                ))}
            </ul>

            {canWrite ? (
                <div className="space-y-2 pt-1">
                    {item.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {item.suggestions.map((suggestion) => (
                                <button
                                    key={suggestion.value}
                                    type="button"
                                    onClick={() => setReplacement(suggestion.value)}
                                    className="text-xs px-2 py-1 rounded-full border border-border hover:bg-muted/40"
                                >
                                    {suggestion.value}{suggestion.count > 1 ? ` ×${suggestion.count}` : ""}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <input
                            type="text"
                            value={replacement}
                            onChange={(e) => setReplacement(e.target.value)}
                            placeholder="Правильный перевод"
                            className="flex-1 min-w-[12rem] px-3 py-1.5 border rounded-lg text-sm bg-background"
                        />
                        <button type="button" disabled={pending || replacement.trim() === ""} onClick={() => run({ kind: "replace", value: replacement })} className={`${BUTTON} bg-blue-600 text-white border-blue-600`}>
                            Заменить
                        </button>
                        <button type="button" disabled={pending} onClick={() => run({ kind: "keep" })} className={`${BUTTON} border-green-600 text-green-700`}>
                            Перевод верен
                        </button>
                        <button type="button" disabled={pending} onClick={() => run({ kind: "clear" })} className={`${BUTTON} border-red-600 text-red-700`}>
                            Очистить
                        </button>
                    </div>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                </div>
            ) : (
                <p className="text-xs text-muted-foreground">Нет права на переводы этого языка ({item.language}) — только просмотр.</p>
            )}
        </div>
    )
}
