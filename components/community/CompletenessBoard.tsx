import Link from "next/link"
import { useTranslations } from "next-intl"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import type { LanguageCompleteness } from "@/lib/community/publicStats"

// Публичный дашборд полноты (roadmap п.76): по каждому языку - кто проверил
// переводы. Это же призыв к волонтёрам: видно, где пробел.
const SEGMENTS: { key: keyof Omit<LanguageCompleteness, "language" | "total">; className: string }[] = [
    { key: "moderator", className: "bg-blue-500" },
    { key: "community", className: "bg-green-500" },
    { key: "inProgress", className: "bg-amber-400" },
    { key: "queued", className: "bg-red-400" },
    { key: "unchecked", className: "bg-slate-300" },
]

export function CompletenessBoard({ rows }: { rows: LanguageCompleteness[] }) {
    const t = useTranslations("community.completeness")
    const languageName = (code: string) => TRANSLATION_LANGUAGES.find((lang) => lang.code === code)
    const ordered = TRANSLATION_LANGUAGES.map((lang) => rows.find((row) => row.language === lang.code)).filter((row): row is LanguageCompleteness => Boolean(row))

    return (
        <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("title")}</h2>
                <Link href="/contribute/leaderboard" className="text-xs text-blue-600">{t("leaderboardLink")} →</Link>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {SEGMENTS.map((segment) => (
                    <span key={segment.key} className="flex items-center gap-1"><span className={`inline-block w-2.5 h-2.5 rounded-sm ${segment.className}`} />{t(segment.key)}</span>
                ))}
            </div>
            <ul className="space-y-1.5">
                {ordered.map((row) => (
                    <li key={row.language} className="flex items-center gap-3 text-xs">
                        <span className="w-28 shrink-0 truncate">{languageName(row.language)?.flag} {languageName(row.language)?.name}</span>
                        <div className="flex-1 h-3 rounded-sm overflow-hidden flex bg-slate-300" title={SEGMENTS.map((s) => `${t(s.key)}: ${row[s.key]}`).join(", ")}>
                            {SEGMENTS.map((segment) => row[segment.key] > 0 && (
                                <div key={segment.key} className={segment.className} style={{ width: `${(row[segment.key] / row.total) * 100}%` }} />
                            ))}
                        </div>
                        <span className="w-12 text-right text-muted-foreground">{Math.round(((row.moderator + row.community) / row.total) * 100)}%</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
