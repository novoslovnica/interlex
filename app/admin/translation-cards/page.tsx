import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import TranslationCardsClient from "./translation-cards-client"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Переводы (карточки) — Админ-панель",
    description: "Модерация переводов в формате карточек.",
}

const TranslationCardsPage = async () => {
    const session = await auth()

    if (!session) redirect("/login")

    await requirePermission(session, "dictionary_edit")

    const userPermissions = session.user.role === "MODERATOR"
        ? (await dbAuth.featurePermission.findMany({
            where: { userId: session.user.id },
            select: { featureKey: true },
        })).map(p => p.featureKey)
        : []

    const userSettings = await dbAuth.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { language: true },
    })

    const currentLanguage = userSettings?.language === "en" ? "en" : "ru"

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <TranslationCardsClient
                currentLanguage={currentLanguage}
                userRole={session.user.role || ""}
                userPermissions={userPermissions}
            />
        </div>
    )
}

export default TranslationCardsPage
