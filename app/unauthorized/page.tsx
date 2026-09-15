import Link from "next/link"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { auth } from "@/auth"

// Target of every redirect("/unauthorized") in lib/permissions.ts and the
// admin pages - covers both "not signed in" and "signed in, but lacking the
// Feature permission", so the call to action depends on which one it is.
export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("unauthorized")
    return { title: t("title"), robots: { index: false } }
}

export default async function UnauthorizedPage() {
    const [t, session] = await Promise.all([getTranslations("unauthorized"), auth()])

    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-sm mx-auto px-4 text-center">
                <h1 className="text-2xl font-bold tracking-tight mb-2">{t("title")}</h1>
                <p className="text-muted-foreground text-sm mb-8">
                    {session ? t("noPermission") : t("signInRequired")}
                </p>

                <div className="space-y-3">
                    {!session && (
                        <Link
                            href="/login"
                            className="block w-full px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                        >
                            {t("signIn")}
                        </Link>
                    )}
                    <Link
                        href="/"
                        className="block w-full px-6 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:underline"
                    >
                        {t("home")}
                    </Link>
                </div>
            </div>
        </div>
    )
}
