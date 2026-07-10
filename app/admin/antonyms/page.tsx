import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth, prismaData as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import { AntonymsClient } from "./antonyms-client"
import AdminNav from "@/components/AdminNav"
import type { Metadata } from "next"
import { buildEntry, append } from "@/lib/action-history"

export const metadata: Metadata = {
  title: "Антонимы",
  description: "Управление антонимами на уровне значений. Поиск и привязка противоположных по смыслу значений слов.",
}

export interface WordItem {
    id: number
    value: string | null
    meanings: {
        id: number
        meaning: string | null
        antonymsSource: {
            id: number
            proximity: number | null
            target: {
                id: number
                meaning: string | null
                lexeme: { id: number; value: string | null }
            }
        }[]
    }[]
}

export default async function AdminAntonymsPage() {
    const session = await auth()
    if (!session) redirect("/unauthorized")

    await requirePermission(session, Feature.AntonymsEdit)

    const userPermissions = session.user.role === "MODERATOR"
        ? (await dbAuth.featurePermission.findMany({
            where: { userId: session.user.id },
            select: { featureKey: true },
          })).map(p => p.featureKey)
        : []

    const initialWords = (await db.lexeme.findMany({
        select: {
            id: true,
            value: true,
            meanings: {
                select: {
                    id: true,
                    meaning: true,
                    antonymsSource: {
                        select: {
                            id: true,
                            proximity: true,
                            target: {
                                select: {
                                    id: true,
                                    meaning: true,
                                    lexeme: {
                                        select: { id: true, value: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        orderBy: { value: "asc" },
        take: 30,
    })) as WordItem[]

    async function updateAntonyms(sourceMeaningId: number, targetMeaningIds: number[]) {
        "use server"

        const author = session?.user?.email || "unknown"

        await db.antonym.deleteMany({
            where: { sourceId: sourceMeaningId }
        })

        if (targetMeaningIds.length > 0) {
            await db.antonym.createMany({
                data: targetMeaningIds.map((tId) => ({
                    sourceId: sourceMeaningId,
                    targetId: tId,
                    proximity: 1.0,
                }))
            })
        }

        const meaning = await db.meaning.findUnique({
            where: { id: sourceMeaningId },
            select: {
                lexeme: {
                    select: { id: true, actionHistory: true }
                }
            }
        })
        if (meaning?.lexeme) {
            await db.lexeme.update({
                where: { id: meaning.lexeme.id },
                data: {
                    actionHistory: append(
                        meaning.lexeme.actionHistory,
                        buildEntry(author, {
                            antonymSourceMeaningId: { old: null, new: sourceMeaningId },
                            antonymTargetMeaningIds: { old: null, new: targetMeaningIds },
                        })
                    )
                }
            })
        }
    }

    return (
        <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
            <div className="flex flex-col h-full overflow-hidden">
                <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
                <div className="px-4 md:px-6 pb-2 shrink-0">
                    <h1 className="text-2xl font-bold">Управление антонимами</h1>
                    <p className="text-muted-foreground text-sm">
                        Выберите слово, затем его значение, чтобы привязать к нему противоположные по смыслу значения других слов.
                    </p>
                </div>
                <div className="flex-1 min-h-0 px-4 md:px-6 overflow-hidden">
                    <AntonymsClient
                        initialWords={initialWords}
                        onUpdateAntonyms={updateAntonyms}
                    />
                </div>
            </div>
        </div>
    )
}