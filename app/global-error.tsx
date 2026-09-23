"use client"

import "./globals.css"

// Ошибка в самом корневом layout: он и NextIntlClientProvider недоступны,
// поэтому текст на трёх языках сразу и без переводов из messages/.
export default function GlobalError({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string }
    unstable_retry: () => void
}) {
    return (
        <html lang="ru">
            <body className="min-h-dvh flex items-center justify-center">
                <title>Ошибка | Interslavic Lexicon</title>
                <div className="w-full max-w-sm mx-auto px-4 text-center">
                    <h1 className="text-2xl font-bold tracking-tight mb-2">Что-то пошло не так</h1>
                    <p className="text-sm mb-1">Something went wrong · Něčto pošlo ne tako</p>
                    <p className="text-sm opacity-70 mb-8">Попробуйте обновить страницу. / Please try again.</p>
                    <button
                        type="button"
                        onClick={() => unstable_retry()}
                        className="block w-full px-6 py-3 rounded-xl border border-gray-300 hover:bg-gray-100 transition-colors text-sm font-medium mb-3"
                    >
                        Попробовать снова / Try again
                    </button>
                    {/* Полная перезагрузка намеренно: сломан корневой layout, клиентская навигация его не пересоберёт. */}
                    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                    <a href="/" className="block w-full px-6 py-3 rounded-xl text-sm font-medium hover:underline">
                        На главную / Home
                    </a>
                    {error.digest && <p className="mt-8 text-xs opacity-70">digest: <code>{error.digest}</code></p>}
                </div>
            </body>
        </html>
    )
}
