import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth, prismaData as db } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { type Prisma } from "../../../prisma/generated/data/client"
import { AntonymsClient } from "./antonyms-client"
import AdminNav from "@/components/AdminNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Антонимы",
  description: "Управление антонимами в словаре межславянского языка. Поиск и привязка противоположных по смыслу слов.",
};

const antonymQuery = {
    select: {
        id: true,
        value: true,
        antonymsRoot: {
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

export type WordWithAntonyms = Prisma.WordGetPayload<{
    select: typeof antonymQuery.select
}>

export default async function AdminAntonymsPage() {
    const session = await auth()
    if (!session) redirect("/unauthorized")

    // Проверка прав доступа (идентично синонимам)
    if (session.user.role !== "ADMIN") {
        if (session.user.role !== "MODERATOR") redirect("/unauthorized")

        const hasFeature = await dbAuth.featurePermission.findFirst({
            where: { userId: session.user.id, featureKey: Feature.DictionaryEdit }
        })
        if (!hasFeature) redirect("/unauthorized")
    }

    // Загружаем стартовые 30 слов по алфавиту для UI
    const initialWords = (await db.word.findMany({
        select: antonymQuery.select,
        orderBy: { value: "asc" },
        take: 30,
    })) as WordWithAntonyms[]

    // Server Action для атомарного обновления антонимов базового слова в SQLite
    async function updateAntonyms(rootWordId: number, antonymIds: number[]) {
        "use server"

        // Удаляем старые связи
        await db.antonym.deleteMany({
            where: { rootId: rootWordId }
        })

        // Записываем новые связи
        if (antonymIds.length > 0) {
            await db.antonym.createMany({
                data: antonymIds.map((aId) => ({
                    rootId: rootWordId,
                    wordId: aId,
                    proximity: 1.0, // Базовый вес противоположности значения
                }))
            })
        }
    }

    return (
        <div className="space-y-4 px-4 md:px-6">
            <AdminNav userRole={session.user.role} />
            <div>
                <h1 className="text-2xl font-bold">Управление антонимами</h1>
                <p className="text-muted-foreground text-sm">
                    Найдите слово через поиск или выберите из списка, чтобы привязать к нему противоположные по смыслу слова (антонимы) с нуля.
                </p>
            </div>

            <AntonymsClient
                initialWords={initialWords}
                onUpdateAntonyms={updateAntonyms}
            />
        </div>
    )
}
