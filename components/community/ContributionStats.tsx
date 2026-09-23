import { useTranslations } from "next-intl"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import type { ContributorSummary } from "@/lib/community/publicStats"

// Блок статистики вклада - один и тот же на /u/<handle> и на /profile.
export function ContributionStats({ summary }: { summary: ContributorSummary }) {
    const t = useTranslations("community.profile")
    const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`)
    const languageName = (code: string) => TRANSLATION_LANGUAGES.find((lang) => lang.code === code)?.name ?? code
    const max = Math.max(1, ...summary.weekly.map((week) => week.votes))
    const tiles: [string, string, string | null][] = [
        [t("answers"), String(summary.votesTotal), null],
        [t("accuracy"), percent(summary.accuracy), t("accuracyHint")],
        [t("confirmed"), String(summary.confirmedTranslations), null],
        [t("streak"), String(summary.streakDays), null],
    ]

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {tiles.map(([label, value, hint]) => (
                    <div key={label} className="border rounded-xl bg-background p-4 shadow-sm border-border/60" title={hint ?? undefined}>
                        <div className="text-2xl font-bold">{value}</div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                ))}
            </div>
            {summary.weekly.length > 0 && (
                <div>
                    <div className="text-xs text-muted-foreground mb-1">{t("weekly")}</div>
                    <div className="flex items-end gap-1 h-12">
                        {summary.weekly.map((week) => (
                            <div key={week.week} title={`${week.week}: ${week.votes}`} className="flex-1 bg-blue-500/60 rounded-sm" style={{ height: `${Math.max(8, (week.votes / max) * 100)}%` }} />
                        ))}
                    </div>
                </div>
            )}
            <div>
                <div className="text-xs text-muted-foreground mb-1">{t("languages")}</div>
                <ul className="text-sm space-y-0.5">
                    {summary.languages.map((lang) => (
                        <li key={lang.language} className="flex justify-between gap-2">
                            <span>{languageName(lang.language)}</span>
                            <span className="text-muted-foreground">{lang.votesTotal} · {percent(lang.accuracy)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
