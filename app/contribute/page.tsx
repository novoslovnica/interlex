import Link from "next/link"
import { auth } from "@/auth"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import type { Metadata } from "next"
import { ScriptPreference } from "@/prisma/generated/auth/enums"
import { ScriptMode } from "@/lib/script-mode"
import { getUserLanguageCodes } from "@/lib/community/access"
import { ContributeClient } from "./contribute-client"
import { init } from "@/lib/sqlite"
import { fetchCompleteness, fetchContributorSummary } from "@/lib/community/publicStats"
import { CompletenessBoard } from "@/components/community/CompletenessBoard"
import { loadRecentComments } from "@/lib/community/loadComments"
import { ContributionStats } from "@/components/community/ContributionStats"

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("community.contribute")
    return { title: t("title"), description: t("description") }
}

// Страница открыта всем: аноним видит, в чём смысл, и кнопку входа; без
// выбранных языков - ссылку в настройки. Сами карточки - только с сессией.
export default async function ContributePage() {
    const session = await auth()
    const t = await getTranslations("community.contribute")
    const userId = session?.user?.id

    const [languages, userSettings] = userId
        ? await Promise.all([
            getUserLanguageCodes(userId),
            dbAuth.userSettings.findUnique({ where: { userId }, select: { script: true } }),
        ])
        : [[], null]
    const currentScript = (userSettings?.script || ScriptPreference.CYRILLIC) as ScriptMode

    const [userProfile, db] = await Promise.all([
        userId ? dbAuth.userProfile.findUnique({ where: { userId }, select: { handle: true } }) : null,
        init(),
    ])
    let completeness, summary
    try {
        completeness = fetchCompleteness(db)
        summary = userId ? fetchContributorSummary(db, userId) : null
    } finally {
        db.close()
    }
    const recentComments = await loadRecentComments(8)

    return (
        <div className="h-full overflow-y-auto max-w-2xl mx-auto space-y-6 px-4 md:px-6 py-10 no-scrollbar">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t("heading")}</h1>
                <p className="text-muted-foreground text-sm mt-1">{t("intro")}</p>
            </div>

            {!userId && (
                <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60 space-y-3">
                    <p className="text-sm">{t("loginPrompt")}</p>
                    <Link href="/login" className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
                        {t("login")}
                    </Link>
                </div>
            )}

            {userId && languages.length === 0 && (
                <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60 space-y-3">
                    <p className="text-sm">{t("noLanguages")}</p>
                    <Link href="/settings" className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
                        {t("chooseLanguages")}
                    </Link>
                </div>
            )}

            {userId && languages.length > 0 && (
                <ContributeClient languages={languages} currentScript={currentScript} />
            )}

            {summary && (
                <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("yourStats")}</h2>
                        {userProfile && <Link href={`/u/${userProfile.handle}`} className="text-xs text-blue-600">{t("profileLink")} →</Link>}
                    </div>
                    <ContributionStats summary={summary} />
                </div>
            )}

            <CompletenessBoard rows={completeness} />

            {recentComments.length > 0 && (
                <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60 space-y-2">
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("recentDiscussions")}</h2>
                    <ul className="space-y-1.5 text-sm">
                        {recentComments.map((comment) => (
                            <li key={comment.id} className="flex gap-2 min-w-0">
                                <Link href={`/words/${comment.lexemeId}`} className="font-semibold text-blue-600 shrink-0">{comment.isv}</Link>
                                <span className="text-muted-foreground truncate">{comment.handle ? `@${comment.handle}: ` : ""}{comment.excerpt}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
