"use client"

import { useState } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import type { WordHistoryEntry } from "@/lib/community/loadWordHistory"

interface WordHistoryProps {
    lexemeId: number
    initialEntries: WordHistoryEntry[]
    total: number
}

// Публичная история изменений слова. Первая страница приходит с сервера,
// дальше - /api/lexicon/[id]/history. Автор: ник → ссылка на /u/<ник>;
// без ника - "модератор"; согласие волонтёров - "сообщество".
export default function WordHistory({ lexemeId, initialEntries, total }: WordHistoryProps) {
    const t = useTranslations("word.history")
    const locale = useLocale()
    const [entries, setEntries] = useState(initialEntries)
    const [loading, setLoading] = useState(false)
    const [failed, setFailed] = useState(false)

    const loadMore = async () => {
        setLoading(true)
        setFailed(false)
        try {
            const response = await fetch(`/api/lexicon/${lexemeId}/history?offset=${entries.length}`)
            if (!response.ok) throw new Error(String(response.status))
            const data = (await response.json()) as { entries: WordHistoryEntry[] }
            setEntries((prev) => [...prev, ...data.entries])
        } catch {
            setFailed(true)
        } finally {
            setLoading(false)
        }
    }

    const languageName = (code: string) => TRANSLATION_LANGUAGES.find((lang) => lang.code === code)?.name ?? code.toUpperCase()
    const describe = (field: string): string => {
        const match = field.match(/^([a-z]+)\.(value|communityStatus|created)$/)
        if (match) return t(`fields.translation_${match[2]}`, { language: languageName(match[1]) })
        return t.has(`fields.${field}`) ? t(`fields.${field}`) : field
    }
    const show = (value: string | null, field: string) => {
        if (value === null || value === "") return t("empty")
        if (field.endsWith(".communityStatus")) return t.has(`status.${value}`) ? t(`status.${value}`) : value
        if (field === "properNoun") return value === "true" ? t("yes") : t("no")
        if (field === "mergedFrom" && /^\d+$/.test(value)) return <Link href={`/words/${value}`} className="text-blue-600">#{value}</Link>
        return value
    }
    const author = (entry: WordHistoryEntry) => {
        if (entry.author.handle) return <Link href={`/u/${entry.author.handle}`} className="text-blue-600">@{entry.author.handle}</Link>
        return <span>{t(`author.${entry.author.kind}`)}</span>
    }

    return (
        <ul className="space-y-3">
            {entries.map((entry) => (
                <li key={entry.actionId} className="text-sm">
                    <p className="text-xs text-slate-400">
                        {new Date(entry.createdAt.replace(" ", "T") + (entry.createdAt.includes("Z") ? "" : "Z")).toLocaleDateString(locale)} · {author(entry)}
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                        {entry.changes.map((change, index) => (
                            <li key={index} className="text-slate-700">
                                <span className="text-slate-500">{describe(change.field)}:</span>{" "}
                                {change.field.endsWith(".created") ? (
                                    <span className="text-green-700">{t("added")}</span>
                                ) : (
                                    <>
                                        <span className="line-through text-slate-400">{show(change.oldValue, change.field)}</span>
                                        {" → "}
                                        <span className="font-medium">{show(change.newValue, change.field)}</span>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                </li>
            ))}
            {entries.length < total && (
                <li>
                    <button type="button" onClick={loadMore} disabled={loading} className="text-xs text-blue-600 disabled:opacity-50">
                        {t("showMore", { remaining: total - entries.length })}
                    </button>
                    {failed && <span className="text-xs text-red-600 ml-2">{t("loadFailed")}</span>}
                </li>
            )}
        </ul>
    )
}
