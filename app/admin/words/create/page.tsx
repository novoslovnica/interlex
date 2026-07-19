import { prismaData as db } from "@/lib/prisma"
import ArticleForm from "@/components/ArticleForm"
import {type Prisma} from "@/prisma/generated/data/client";
import {redirect} from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { buildEntry, append } from "@/lib/action-history"
import { generateUniqueSlug } from "@/lib/slug"

export const metadata: Metadata = {
  title: "Создание статьи",
  description: "Создание новой словарной статьи в базе межславянского лексикона с указанием основы, корней и переводов.",
};

const rootInclude = {
    lexemes_morphemes: {
        take: 10,
        select: {
            id: true,
            lexeme: {
                select: {
                    id: true,
                    value: true,
                },
            },
        },
    },
}

export type MorphemeWithLexemes = Prisma.MorphemeGetPayload<{
    include: typeof rootInclude
}>

export default async function CreateArticlePage() {
    const session = await auth()
    if (!session) redirect("/login")
    await requirePermission(session, Feature.WordsCreate)

    const pageSize = 30

    const initialRoots = (await db.morpheme.findMany({
        include: rootInclude,
        orderBy: { value: "asc" },
        take: pageSize,
    })) as MorphemeWithLexemes[]

    async function createArticle(formData: any) {
        "use server"
        const session = await auth()
        const author = session?.user?.email || "unknown"
        const stemValue = formData.stem?.trim() || null
        const posValue = formData.pos?.trim() || "unknown"
        const slug = await generateUniqueSlug(formData.word?.toLowerCase() || "", posValue)

        const newWord = await db.lexeme.create({
            data: {
                value: formData.word,
                slug,
                stem: stemValue,
                hasAnomalies: formData.hasAnomalies === true,
                actionHistory: append(null, buildEntry(author, {
                    value: { old: null, new: formData.word },
                    stem: { old: null, new: stemValue },
                    hasAnomalies: { old: null, new: formData.hasAnomalies === true },
                })),
            },
        })

        const allophoneData = formData.allophones || {}
        for (const code of ["CORE", "NSL", "EAST", "WEST", "SOUTH"] as const) {
            const strValue = (allophoneData[code.toLowerCase()] as string)?.trim()
            if (!strValue) continue
            const flavor = await db.allophoneFlavor.findUnique({ where: { code } })
            if (!flavor) continue
            await db.lexemeAllophone.create({
                data: { lexemeId: newWord.id, flavorId: flavor.id, type: "standard", value: strValue },
            })
        }

        if (stemValue) {
            const existing = await db.baseHomonym.findUnique({
                where: { base: stemValue },
            })
            if (existing) {
                const ids: number[] = JSON.parse(existing.wordIds)
                if (!ids.includes(newWord.id)) {
                    ids.push(newWord.id)
                    await db.baseHomonym.update({
where: { base: stemValue },
                        data: { wordIds: JSON.stringify(ids) },
                    })
                }
            } else {
                await db.baseHomonym.create({
                    data: {
                        base: stemValue,
                        wordIds: JSON.stringify([newWord.id]),
                    },
                })
            }
        }

        const anomalies = formData.inflectionAnomalies || []
        if (anomalies.length > 0) {
            await db.inflectionAnomaly.createMany({
                data: anomalies.map((a: { inflection: string; grammeme: string }) => ({
                    lexemeId: newWord.id,
                    inflection: a.inflection,
                    grammeme: a.grammeme,
                })),
            })
        }

        const newMeaning = await db.meaning.create({
            data: {
                lexemeId: newWord.id,
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
                const newRoot = await db.morpheme.create({
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
            await db.lexemeMorpheme.createMany({
                data: finalRootIds.map((rId) => ({
                    lexemeId: newWord.id,
                    morphemeId: rId,
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