import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth, prismaData as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import { AntonymsClient } from "./antonyms-client"
import AdminNav from "@/components/AdminNav"
import type { Metadata } from "next"
import { logAudit } from "@/lib/audit-log"
import { init } from "@/lib/sqlite"
import { fetchSymmetricRelations, saveSymmetricRelation } from "@/lib/relations"

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

    const rawWords = await db.lexeme.findMany({
        select: {
            id: true,
            value: true,
            meanings: {
                select: { id: true, meaning: true },
            },
        },
        orderBy: { value: "asc" },
        take: 30,
    })

    const dbSimple = await init()
    const allMeaningIds = rawWords.flatMap((w) => w.meanings.map((m) => m.id))
    const relationsByMeaning = fetchSymmetricRelations(dbSimple, "antonyms", allMeaningIds)

    const initialWords: WordItem[] = rawWords.map((w) => ({
        id: w.id,
        value: w.value,
        meanings: w.meanings.map((m) => ({
            id: m.id,
            meaning: m.meaning,
            antonymsSource: (relationsByMeaning.get(m.id) || []).map((r) => ({
                id: r.relationId,
                proximity: r.proximity,
                target: {
                    id: r.otherMeaningId,
                    meaning: r.otherMeaning,
                    lexeme: { id: r.otherWordId ?? 0, value: r.otherWord },
                },
            })),
        })),
    }))

    async function updateAntonyms(sourceMeaningId: number, targetMeaningIds: number[]) {
        "use server"

        saveSymmetricRelation(dbSimple, "antonyms", sourceMeaningId, targetMeaningIds, 1.0)

        const meaning = await db.meaning.findUnique({
            where: { id: sourceMeaningId },
            select: { lexeme: { select: { id: true } } }
        })
        if (meaning?.lexeme) {
            await logAudit(session?.user, "Lexeme", meaning.lexeme.id, [
                { field: "antonymSourceMeaningId", oldValue: null, newValue: sourceMeaningId },
                { field: "antonymTargetMeaningIds", oldValue: null, newValue: targetMeaningIds },
            ])
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