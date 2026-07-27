import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AdminNav from "@/components/AdminNav"
import { prismaAuth as dbAuth } from "@/lib/prisma"
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

    const userPermissions = session.user.role === "MODERATOR"
        ? (await dbAuth.featurePermission.findMany({
            where: { userId: session.user.id },
            select: { featureKey: true },
        })).map(p => p.featureKey)
        : []

    return (
        <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
            <div className="flex flex-col h-full overflow-hidden">
                <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
                <WordCardsClient />
            </div>
        </div>
    )
}

export default WordCardsPage
