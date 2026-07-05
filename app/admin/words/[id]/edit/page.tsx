import { prismaData as db } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { type Prisma } from "@/prisma/generated/data/client"
import ArticleForm from "@/components/ArticleForm"
import type { Metadata } from "next";
import { auth } from "@/auth"
import { buildEntry, append } from "@/lib/action-history"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const word = await db.word.findUnique({ where: { id: parseInt(id, 10) }, select: { value: true } });
  return {
    title: `Редактирование: ${word?.value ?? id}`,
    description: `Редактирование словарной статьи «${word?.value ?? id}» в базе межславянского лексикона.`,
  };
}

const rootSelectStructure = {
    id: true,
    value: true,
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
    select: typeof rootSelectStructure
}>

interface EditPageProps {
    params: Promise<{ id: string }>
}

export default async function EditArticlePage({ params }: EditPageProps) {
    const { id } = await params
    const wordId = parseInt(id, 10)

    if (isNaN(wordId)) notFound()

    // 2. Параллельно загружаем редактируемое слово и первые 30 корней для формы
    const [wordData, initialRoots] = await Promise.all([
        db.word.findUnique({
            where: { id: wordId },
            include: {
                meanings: {
                    include: {
                        en_word: true,
                        ru_word: true,
                    },
                },
                roots_words: {
                    take: 1,
                    select: {
                        rootId: true,
                        root: {
                            select: {
                                value: true,
                            },
                        },
                    },
                },
                anomalies: true,
            },
        }),
        db.root.findMany({
            select: rootSelectStructure,
            orderBy: { value: "asc" },
            take: 30,
        }) as Promise<RootWithWords[]>,
    ])

    if (!wordData) notFound()

    // Извлекаем текущие переводы (En и Ru) из структуры связей вашей БД
    const firstMeaning = wordData.meanings?.[0]
    const currentTranslationEn = firstMeaning?.en_word?.[0]?.value || ""
    const isEnVerified = firstMeaning?.en_word?.[0]?.veryfied === 1

    const currentTranslationRu = firstMeaning?.ru_word?.[0]?.value || ""
    const isRuVerified = firstMeaning?.ru_word?.[0]?.veryfied === 1

    const currentAnomalies = (wordData.anomalies || []).map(a => ({
        inflection: a.inflection,
        grammeme: a.grammeme,
    }))

    // 3. Функция обновления статьи (Server Action)
    async function updateArticle(formData: any) {
        "use server"
        const session = await auth()
        const author = session?.user?.email || "unknown"

        const baseValue = formData.base?.trim() || null

        // Получаем текущее слово, чтобы сравнить старую и новую основу
        const currentWord = await db.word.findUnique({ where: { id: wordId } })
        const currentWordWithHistory = currentWord as { actionHistory?: string | null } & typeof currentWord

        // Собираем изменения для аудита
        const wordChanges: Record<string, { old: unknown; new: unknown }> = {}
        if (currentWord?.value !== formData.word) {
            wordChanges.value = { old: currentWord?.value ?? null, new: formData.word }
        }
        if ((currentWord?.base ?? null) !== baseValue) {
            wordChanges.base = { old: currentWord?.base ?? null, new: baseValue }
        }
        if (currentWord?.hasAnomalies !== (formData.hasAnomalies === true)) {
            wordChanges.hasAnomalies = { old: currentWord?.hasAnomalies, new: formData.hasAnomalies === true }
        }

        // Обновляем базовое слово
        await db.word.update({
            where: { id: wordId },
            data: {
                value: formData.word,
                base: baseValue,
                hasAnomalies: formData.hasAnomalies === true,
                ...(Object.keys(wordChanges).length > 0 ? {
                    actionHistory: append(currentWordWithHistory?.actionHistory, buildEntry(author, wordChanges)),
                } : {}),
            },
        })

        // Синхронизируем base_homonyms
        const oldBase = currentWord?.base?.trim() || null

        // Если старая основа была и отличается от новой — удаляем wordId из старой
        if (oldBase && oldBase !== baseValue) {
            const oldEntry = await db.baseHomonym.findUnique({
                where: { base: oldBase },
            })
            if (oldEntry) {
                const ids: number[] = JSON.parse(oldEntry.wordIds).filter((id: number) => id !== wordId)
                if (ids.length > 0) {
                    await db.baseHomonym.update({
                        where: { base: oldBase },
                        data: { wordIds: JSON.stringify(ids) },
                    })
                } else {
                    await db.baseHomonym.delete({ where: { base: oldBase } })
                }
            }
        }

        // Если новая основа указана — добавляем/обновляем в base_homonyms
        if (baseValue) {
            const existing = await db.baseHomonym.findUnique({
                where: { base: baseValue },
            })
            if (existing) {
                const ids: number[] = JSON.parse(existing.wordIds)
                if (!ids.includes(wordId)) {
                    ids.push(wordId)
                    await db.baseHomonym.update({
                        where: { base: baseValue },
                        data: { wordIds: JSON.stringify(ids) },
                    })
                }
            } else {
                await db.baseHomonym.create({
                    data: {
                        base: baseValue,
                        wordIds: JSON.stringify([wordId]),
                    },
                })
            }
        }

        // Синхронизируем аномалии флексий: удаляем старые, создаём новые
        await db.inflectionAnomaly.deleteMany({
            where: { wordId: wordId },
        })
        const anomalies = formData.inflectionAnomalies || []
        if (anomalies.length > 0) {
            await db.inflectionAnomaly.createMany({
                data: anomalies.map((a: { inflection: string; grammeme: string }) => ({
                    wordId: wordId,
                    inflection: a.inflection,
                    grammeme: a.grammeme,
                })),
            })
        }

        // Логика обновления/создания корня
        // let targetRootId = formData.rootId
        //
        // if (formData.newRootValue) {
        //     // Если администратор ввел новый корень в поиск и нажал "Создать"
        //     const newRoot = await db.root.create({
        //         data: { value: formData.newRootValue },
        //     })
        //     targetRootId = newRoot.id
        // }
        //
        // // Обновляем связь слова с корнем в таблице roots_words
        // if (targetRootId !== currentRootId) {
        //     // Удаляем старую связь
        //     await db.rootWord.deleteMany({
        //         where: { wordId: wordId },
        //     })
        //
        //     // Если выбран какой-то корень (старый или только что созданный) — создаем новую запись
        //     if (targetRootId) {
        //         await db.rootWord.create({
        //             data: {
        //                 wordId: wordId,
        //                 rootId: targetRootId,
        //             },
        //         })
        //     }
        // }

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

        // 3. Объединяем старые выбранные ID и только что созданные ID корней
        const finalRootIds = [...formData.rootIds, ...createdRootIds]

        // 4. Синхронизируем таблицу связей roots_words для этого слова
        // Удаляем все прошлые связи слова с корнями
        await db.rootWord.deleteMany({
            where: { wordId: wordId },
        })

        // Записываем новые связи
        if (finalRootIds.length > 0) {
            await db.rootWord.createMany({
                data: finalRootIds.map((rId) => ({
                    wordId: wordId,
                    rootId: rId,
                })),
            })
        }

        // Возвращаем пользователя обратно в админку к списку
        redirect("/admin/dictionary")
    }

    if (!wordData) notFound()

    // Трансформируем связи из базы в плоский массив объектов для initialData
    const attachedRoots = (wordData.roots_words || [])
        .map((rw) => rw.root)
        .filter((r): r is { id: number; value: string } => !!r && !!r.value)

    return (
        <div className="py-6">
            <ArticleForm
                title={`Редактирование статьи: ${wordData.value || "Без названия"}`}
                submitButtonText="Сохранить изменения"
                initialRoots={initialRoots}
                onSubmit={updateArticle}
                initialData={{
                    word: wordData.value || "",
                    base: wordData.base || "",
                    hasAnomalies: wordData.hasAnomalies,
                    inflectionAnomalies: currentAnomalies,
                    translationEn: currentTranslationEn,
                    translationRu: currentTranslationRu,
                    attachedRoots: attachedRoots,
                    isEnVerified: isEnVerified,
                    isRuVerified: isRuVerified,
                }}
            />
        </div>
    )
}
