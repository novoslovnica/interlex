import Link from "next/link"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import { init } from "@/lib/sqlite"
import { fetchLeaderboard } from "@/lib/community/publicStats"
import { resolvePublicNames } from "@/lib/community/identity"

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("community.leaderboard")
    return { title: t("title"), description: t("description") }
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string; lang?: string }> }) {
    const { period, lang } = await searchParams
    const t = await getTranslations("community.leaderboard")
    const week = period !== "all"
    const language = TRANSLATION_LANGUAGES.some((entry) => entry.code === lang) ? lang : undefined

    const db = await init()
    let rows
    try {
        rows = fetchLeaderboard(db, { language, sinceDays: week ? 7 : undefined, limit: 50 })
    } finally {
        db.close()
    }
    // Вторая фаза: имена только через identity.ts (ник или "Аноним").
    const names = await resolvePublicNames(rows.map((row) => row.userId))

    const href = (next: { period?: string; lang?: string }) => {
        const search = new URLSearchParams()
        const p = next.period ?? (week ? "week" : "all")
        const l = "lang" in next ? next.lang : language
        if (p === "all") search.set("period", "all")
        if (l) search.set("lang", l)
        const text = search.toString()
        return `/contribute/leaderboard${text ? `?${text}` : ""}`
    }
    const chip = (active: boolean) => `px-3 py-1 rounded-full border text-sm ${active ? "bg-blue-600 text-white border-blue-600" : "border-border"}`

    return (
        <div className="h-full overflow-y-auto max-w-2xl mx-auto space-y-6 px-4 md:px-6 py-10 no-scrollbar">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                <p className="text-muted-foreground text-sm mt-1">{t("description")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <Link href={href({ period: "week" })} className={chip(week)}>{t("week")}</Link>
                <Link href={href({ period: "all" })} className={chip(!week)}>{t("all")}</Link>
            </div>
            <div className="flex flex-wrap gap-2">
                <Link href={href({ lang: undefined })} className={chip(!language)}>{t("allLanguages")}</Link>
                {TRANSLATION_LANGUAGES.map((entry) => (
                    <Link key={entry.code} href={href({ lang: entry.code })} className={chip(language === entry.code)}>{entry.flag} {entry.name}</Link>
                ))}
            </div>
            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
                <ol className="space-y-1">
                    {rows.map((row, index) => {
                        const handle = names.get(row.userId)
                        return (
                            <li key={row.userId} className="flex items-center gap-3 border rounded-lg bg-background px-4 py-2 border-border/60">
                                <span className="w-6 text-right text-muted-foreground text-sm">{index + 1}</span>
                                {handle ? <Link href={`/u/${handle}`} className="font-medium text-blue-600">@{handle}</Link> : <span className="text-muted-foreground">{t("anonymous")}</span>}
                                <span className="ml-auto text-sm">{row.votes} {t("answers")}</span>
                                <span className="text-xs text-muted-foreground">{row.agreed} {t("agreed")}</span>
                            </li>
                        )
                    })}
                </ol>
            )}
        </div>
    )
}
