import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ALL_MAIN_CATEGORIES } from "@/lib/enums/MainCategory"
import { prismaData } from "@/lib/prisma"

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("lexicon.topics")
    return { title: t("title"), description: t("description") }
}

export default async function LexiconTopicsPage() {
    const [t, categoryLabels, counts] = await Promise.all([
        getTranslations("lexicon.topics"),
        getTranslations("lexicon.categories"),
        prismaData.lexeme.groupBy({
            by: ["mainCategory"],
            where: { isPublic: true, mainCategory: { in: ALL_MAIN_CATEGORIES } },
            _count: { _all: true },
        }),
    ])
    const countByCategory = new Map(counts.map(({ mainCategory, _count }) => [mainCategory, _count._all]))
    const topics = ALL_MAIN_CATEGORIES.flatMap(category => {
        const count = countByCategory.get(category)
        return count ? [{ category, count }] : []
    })

    return (
        <main className="min-h-0 flex-1 overflow-y-auto bg-background text-foreground">
            <div className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-8 sm:py-12">
                <header className="space-y-3">
                    <Link href="/lexicon" className="text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                        {t("back")}
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
                    <p className="text-muted-foreground">{t("description")}</p>
                </header>
                {topics.length > 0 ? (
                    <ul className="grid gap-3 sm:grid-cols-2">
                        {topics.map(({ category, count }) => (
                            <li key={category}>
                                <Link
                                    href={{ pathname: "/lexicon", query: { mainCategory: category } }}
                                    className="flex h-full items-baseline justify-between gap-3 rounded-xl border bg-card px-4 py-4 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                    <span className="font-semibold">{categoryLabels(category)}</span>
                                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{t("count", { count })}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">{t("empty")}</p>
                )}
            </div>
        </main>
    )
}
