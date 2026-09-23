import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getTranslations, getLocale } from "next-intl/server"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import { init } from "@/lib/sqlite"
import { fetchPublicProfile } from "@/lib/community/publicProfile"
import { fetchContributorSummary } from "@/lib/community/publicStats"
import { ContributionStats } from "@/components/community/ContributionStats"

// Публичная страница участника. Существует только у тех, кто задал ник;
// показывает исключительно ник, "о себе", языки и статистику ответов.
export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
    const { handle } = await params
    const t = await getTranslations("community.profile")
    return { title: t("title", { handle }), robots: { index: false } }
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
    const { handle } = await params
    const profile = await fetchPublicProfile(handle)
    if (!profile) notFound()

    const t = await getTranslations("community.profile")
    const locale = await getLocale()
    const db = await init()
    let summary
    try {
        summary = fetchContributorSummary(db, profile.userId)
    } finally {
        db.close()
    }
    const languageName = (code: string) => TRANSLATION_LANGUAGES.find((lang) => lang.code === code)

    return (
        <div className="h-full overflow-y-auto max-w-2xl mx-auto space-y-6 px-4 md:px-6 py-10 no-scrollbar">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">@{profile.handle}</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    {t("memberSince", { date: profile.createdAt.toLocaleDateString(locale) })}
                    {profile.languages.length > 0 && ` · ${profile.languages.map((code) => languageName(code)?.flag ?? code).join(" ")}`}
                </p>
                {profile.bio && <p className="text-sm mt-3 whitespace-pre-line">{profile.bio}</p>}
            </div>
            {summary ? <ContributionStats summary={summary} /> : <p className="text-sm text-muted-foreground">{t("noStats")}</p>}
        </div>
    )
}
