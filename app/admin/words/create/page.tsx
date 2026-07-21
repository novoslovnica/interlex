import { prismaData as db } from "@/lib/prisma"
import ArticleForm from "@/components/ArticleForm"
import {type Prisma} from "@/prisma/generated/data/client";
import {redirect} from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { createWord } from "@/lib/actions/word-actions"

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

    async function handleCreate(formData: any) {
        "use server"
        return createWord(formData)
    }

    return (
        <div className="py-6">
            <ArticleForm
                title="Создание новой словарной статьи"
                submitButtonText="Создать статью"
                initialRoots={initialRoots}
                onSubmit={handleCreate}
            />
        </div>
    )
}