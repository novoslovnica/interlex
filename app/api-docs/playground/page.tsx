import Link from "next/link"
import type { Metadata } from "next"
import PlaygroundClient from "./PlaygroundClient"

export const metadata: Metadata = {
    title: "API playground",
    description: "Try the public read-only API right in the browser, without an API key.",
}

export default function ApiPlaygroundPage() {
    return (
        <div className="h-full overflow-y-auto mx-auto max-w-3xl space-y-6 px-4 md:px-6 py-10 no-scrollbar">
            <div>
                <Link href="/api-docs" className="text-blue-600 text-sm font-medium hover:underline">
                    ← Документация API
                </Link>
                <h1 className="text-2xl font-bold tracking-tight mt-2">API playground</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Выберите эндпоинт, заполните параметры и отправьте запрос прямо из браузера — без своего API-ключа и без расхода его лимита.
                </p>
            </div>

            <PlaygroundClient />
        </div>
    )
}
