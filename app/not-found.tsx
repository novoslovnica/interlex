import Link from "next/link"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

// Корневой 404: и для несуществующих адресов, и для каждого notFound() на
// страницах (слово, статья библиотеки, праслав. статья, профиль участника).
export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("errors")
    return { title: t("notFoundTitle"), robots: { index: false } }
}

export default async function NotFound() {
    const t = await getTranslations("errors")

    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md mx-auto px-4 text-center">
                <p className="text-5xl font-bold tracking-tight text-muted-foreground mb-4">404</p>
                <h1 className="text-2xl font-bold tracking-tight mb-2">{t("notFoundTitle")}</h1>
                <p className="text-muted-foreground text-sm mb-8">{t("notFoundText")}</p>

                <form action="/lexicon" method="get" className="flex gap-2 mb-4">
                    <input
                        type="search"
                        name="q"
                        aria-label={t("searchLexicon")}
                        placeholder={t("searchLexicon")}
                        className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm"
                    />
                    <button
                        type="submit"
                        className="px-5 py-3 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                        {t("searchLexicon")}
                    </button>
                </form>
                <Link href="/" className="block w-full px-6 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:underline">
                    {t("home")}
                </Link>
            </div>
        </div>
    )
}
