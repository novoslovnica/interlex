"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"

// Ошибка любой страницы под корневым layout (шапка и NextIntlClientProvider
// остаются). Ошибки самого layout ловит app/global-error.tsx.
export default function ErrorPage({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string }
    unstable_retry: () => void
}) {
    const t = useTranslations("errors")

    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-sm mx-auto px-4 text-center">
                <h1 className="text-2xl font-bold tracking-tight mb-2">{t("errorTitle")}</h1>
                <p className="text-muted-foreground text-sm mb-8">{t("errorText")}</p>
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={() => unstable_retry()}
                        className="block w-full px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                        {t("retry")}
                    </button>
                    <Link href="/" className="block w-full px-6 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:underline">
                        {t("home")}
                    </Link>
                </div>
                {/* digest совпадает с записью в серверном логе - по нему ошибку можно найти. */}
                {error.digest && (
                    <p className="mt-8 text-xs text-muted-foreground">
                        {t("errorCode")}: <code>{error.digest}</code>
                    </p>
                )}
            </div>
        </div>
    )
}
