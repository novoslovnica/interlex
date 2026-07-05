import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth, prismaData as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { type Prisma } from "../../../prisma/generated/data/client"
import { SynonymsClient } from "./synonyms-client"
import AdminNav from "@/components/AdminNav";
import type { Metadata } from "next";
import { buildEntry, append } from "@/lib/action-history"

export const metadata: Metadata = {
  title: "Синонимы",
  description: "Управление синонимами в словаре межславянского языка. Поиск и привязка близких по смыслу слов.",
};

const synonymQuery = {
    select: {
        id: true,
        value: true,
        synonymsRoot: {
            select: {
                id: true,
                proximity: true,
                word: {
                    select: { id: true, value: true }
                }
            }
        }
    }
}

export type WordWithSynonyms = Prisma.WordGetPayload<{
    select: typeof synonymQuery.select
}>

export default async function AdminSynonymsPage() {
    const session = await auth()
    if (!session) redirect("/unauthorized")

    if (session.user.role !== "ADMIN") {
        if (session.user.role !== "MODERATOR") redirect("/unauthorized")
        const hasFeature = await dbAuth.featurePermission.findFirst({
            where: { userId: session.user.id, featureKey: Feature.DictionaryEdit }
        })
        if (!hasFeature) redirect("/unauthorized")
    }

    // Загружаем просто первые 30 слов по алфавиту для стартового UI
    const initialWords = (await db.word.findMany({
        select: synonymQuery.select,
        orderBy: { value: "asc" },
        take: 30,
    })) as WordWithSynonyms[]

    async function updateSynonyms(rootWordId: number, synonymIds: number[]) {
        "use server"

        const author = session?.user?.email || "unknown"

        await db.synonym.deleteMany({
            where: { rootId: rootWordId }
        })

        if (synonymIds.length > 0) {
            await db.synonym.createMany({
                data: synonymIds.map((sId) => ({
                    rootId: rootWordId,
                    wordId: sId,
                    proximity: 1.0,
                }))
            })
        }

        const word = await db.word.findUnique({ where: { id: rootWordId } }) as { actionHistory?: string | null } | null
        await db.word.update({
            where: { id: rootWordId },
            data: { actionHistory: append(word?.actionHistory, buildEntry(author, { synonymIds: { old: null, new: synonymIds } })) }
        })
    }

    return (
        <div className="space-y-4 px-4 md:px-6">
            <AdminNav userRole={session.user.role} />
            <div>
                <h1 className="text-2xl font-bold">Управление синонимами</h1>
                <p className="text-muted-foreground text-sm">
                    Найдите слово через поиск или выберите из списка слева, чтобы привязать к нему синонимы с нуля.
                </p>
            </div>

            <SynonymsClient
                initialWords={initialWords}
                onUpdateSynonyms={updateSynonyms}
            />
        </div>
    )
}
