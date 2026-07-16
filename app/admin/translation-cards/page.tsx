import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AdminNav from "@/components/AdminNav"
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
        <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
            <div>
                <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
                <TranslationCardsClient
                    currentLanguage={currentLanguage}
                    userRole={session.user.role || ""}
                    userPermissions={userPermissions}
                />
            </div>
        </div>
    )
}

export default TranslationCardsPage