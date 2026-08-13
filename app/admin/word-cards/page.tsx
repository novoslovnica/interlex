import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import WordCardsClient from "./word-cards-client"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Слова (карточки) — Админ-панель",
    description: "Модерация слов (флаворизация CORE) в формате карточек.",
}

const WordCardsPage = async () => {
    const session = await auth()

    if (!session) redirect("/login")

    await requirePermission(session, Feature.WordsEdit)

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <WordCardsClient />
        </div>
    )
}

export default WordCardsPage
