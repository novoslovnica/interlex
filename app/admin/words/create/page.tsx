import { prismaData as db } from "@/lib/prisma"
import ArticleForm from "@/components/ArticleForm"
import {type Prisma} from "@/prisma/generated/data/client";
import {redirect} from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth"
import { buildEntry, append } from "@/lib/action-history"

export const metadata: Metadata = {
  title: "Создание статьи",
  description: "Создание новой словарной статьи в базе межславянского лексикона с указанием основы, корней и переводов.",
};

const rootInclude = {
    roots_words: {
        take: 10,
        select: {
            id: true,
            word: {
                select: {
                    id: true,
                    value: true,
                },
            },
        },
    },
}

export type RootWithWords = Prisma.RootGetPayload<{
    include: typeof rootInclude
}>

export default async function CreateArticlePage() {
    const pageSize = 30

    const initialRoots = (await db.root.findMany({
        include: rootInclude,
        orderBy: { value: "asc" },
        take: pageSize,
    })) as RootWithWords[]

    async function createArticle(formData: any) {
        "use server"
        const session = await auth()
        const author = session?.user?.email || "unknown"
        const baseValue = formData.base?.trim() || null

        const newWord = await db.word.create({
            data: {
                value: formData.word,
                base: baseValue,
                hasAnomalies: formData.hasAnomalies === true,
                actionHistory: append(null, buildEntry(author, {
                    value: { old: null, new: formData.word },
                    base: { old: null, new: baseValue },
                    hasAnomalies: { old: null, new: formData.hasAnomalies === true },
                })),
            },
        })

        if (baseValue) {
            const existing = await db.baseHomonym.findUnique({
                where: { base: baseValue },
            })
            if (existing) {
                const ids: number[] = JSON.parse(existing.wordIds)
                if (!ids.includes(newWord.id)) {
                    ids.push(newWord.id)
                    await db.baseHomonym.update({
                        where: { base: baseValue },
                        data: { wordIds: JSON.stringify(ids) },
                    })
                }
            } else {
                await db.baseHomonym.create({
                    data: {
                        base: baseValue,
                        wordIds: JSON.stringify([newWord.id]),
                    },
                })
            }
        }

        const anomalies = formData.inflectionAnomalies || []
        if (anomalies.length > 0) {
            await db.inflectionAnomaly.createMany({
                data: anomalies.map((a: { inflection: string; grammeme: string }) => ({
                    wordId: newWord.id,
                    inflection: a.inflection,
                    grammeme: a.grammeme,
                })),
            })
        }

        const newMeaning = await db.meaning.create({
            data: {
                wordId: newWord.id,
                meaning: "Основное значение",
            },
        })

        await db.en.create({
            data: {
                meaningId: newMeaning.id,
                value: formData.translationEn,
                veryfied: formData.isEnVerified ? 1 : 0,
                actionHistory: append(null, buildEntry(author, {
                    value: { old: null, new: formData.translationEn },
                    veryfied: { old: null, new: formData.isEnVerified ? 1 : 0 },
                })),
            },
        })

        await db.ru.create({
            data: {
                meaningId: newMeaning.id,
                value: formData.translationRu,
                veryfied: formData.isRuVerified ? 1 : 0,
                actionHistory: append(null, buildEntry(author, {
                    value: { old: null, new: formData.translationRu },
                    veryfied: { old: null, new: formData.isRuVerified ? 1 : 0 },
                })),
            },
        })

        const createdRootIds: number[] = []
        if (formData.newRootValues && formData.newRootValues.length > 0) {
            for (const val of formData.newRootValues) {
                const newRoot = await db.root.create({
                    data: {
                        value: val,
                        type: 0,
                        actionHistory: append(null, buildEntry(author, {
                            value: { old: null, new: val },
                            type: { old: null, new: 0 },
                        })),
                    },
                })
                createdRootIds.push(newRoot.id)
            }
        }

        const finalRootIds = [...(formData.rootIds || []), ...createdRootIds]

        if (finalRootIds.length > 0) {
            await db.rootWord.createMany({
                data: finalRootIds.map((rId) => ({
                    wordId: newWord.id,
                    rootId: rId,
                })),
            })
        }

        redirect("/admin/dictionary")
    }

    return (
        <div className="py-6">
            <ArticleForm
                title="Создание новой словарной статьи"
                submitButtonText="Создать статью"
                initialRoots={initialRoots}
                onSubmit={createArticle}
            />
        </div>
    )
}