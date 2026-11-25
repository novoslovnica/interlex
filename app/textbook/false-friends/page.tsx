import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { BEGINNER_ROUTE, FALSE_FRIENDS } from "@/lib/beginner-route"
import { getUserScript } from "@/lib/get-user-script"
import { prismaData } from "@/lib/prisma"
import { writeOrTranslate } from "@/lib/script-mode"

// Each entry compares a specific Interslavic sense with common modern Russian usage.
const pairs = [
    { key: "krasny", lexemeId: 10319, word: "krasny", russian: "красный", russianSource: "https://ruslang.ru/sites/default/files/2024-12/ASRYa-4-2.pdf" },
    { key: "nedelja", lexemeId: 12516, word: "nedělja", russian: "неделя", russianSource: "https://gufo.me/dict/ozhegov/неделя", interslavicSource: "https://interslavic.fun/standard/appendices/samples/" },
    { key: "zivot", lexemeId: 22358, word: "život", russian: "живот", russianSource: "https://ozhegov.info/slovar/?ex=Y&q=ЖИВОТ" },
] as const

const focus = "underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("falseFriends")
    return { title: t("title"), description: t("description"), alternates: { canonical: FALSE_FRIENDS } }
}

export default async function FalseFriendsPage() {
    const [t, beginner, script, words] = await Promise.all([
        getTranslations("falseFriends"),
        getTranslations("beginner"),
        getUserScript(),
        prismaData.lexeme.findMany({
            where: { id: { in: pairs.map(pair => pair.lexemeId) }, isPublic: true, value: { not: null } },
            select: { id: true },
        }),
    ])
    const published = new Set(words.map(({ id }) => id))

    return (
        <main className="min-h-0 flex-1 overflow-y-auto bg-background text-foreground">
            <article className="mx-auto max-w-3xl space-y-6 px-5 py-8">
                <nav aria-label={t("navigation")} className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    <Link href={BEGINNER_ROUTE} className={focus}>{beginner("title")}</Link>
                    <Link href="/textbook/phonetic-laws" className={focus}>{t("reference")}</Link>
                </nav>
                <header className="space-y-2">
                    <h1 className="text-3xl font-bold">{t("title")}</h1>
                    <p className="text-muted-foreground">{t("description")}</p>
                </header>
                <ul className="space-y-4">
                    {pairs.map(pair => {
                        const word = writeOrTranslate(pair.word, script)
                        return (
                            <li key={pair.key} className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
                                <dl className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <dt className="text-sm text-muted-foreground">{t("interslavic")}</dt>
                                        <dd>
                                            {published.has(pair.lexemeId)
                                                ? <Link href={`/words/${pair.lexemeId}`} lang="isv" className={`text-lg font-semibold ${focus}`}>{word}</Link>
                                                : <span lang="isv" className="text-lg font-semibold">{word}</span>}
                                            <p>{t(`pairs.${pair.key}.isvMeaning`)}</p>
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">{t("russian")}</dt>
                                        <dd>
                                            <a href={pair.russianSource} lang="ru" className={`text-lg font-semibold ${focus}`}>{pair.russian}</a>
                                            <p>{t(`pairs.${pair.key}.ruMeaning`)}</p>
                                        </dd>
                                    </div>
                                </dl>
                                <p className="text-sm text-muted-foreground">{t(`pairs.${pair.key}.note`, { word: writeOrTranslate("sedmica", script) })}</p>
                                {"interslavicSource" in pair && (
                                    <a href={pair.interslavicSource} className={`text-sm ${focus}`}>{t("usageSource")}</a>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </article>
        </main>
    )
}
