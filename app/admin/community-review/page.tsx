import Link from "next/link"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { prismaAuth as dbAuth, prismaData } from "@/lib/prisma"
import { requirePermission, checkPermission } from "@/lib/permissions"
import { Feature, TRANSLATION_LANGUAGES } from "@/config/features"
import { init } from "@/lib/sqlite"
import { countReviewQueue, countReviewQueueByLanguage, fetchReviewQueue } from "@/lib/community/moderatorReview"
import CommunityReviewClient from "./community-review-client"

export const metadata: Metadata = {
    title: "Ответы сообщества | Админ-панель",
    description: "Переводы, отклонённые или оспоренные волонтёрами на публичных карточках проверки.",
}

const PAGE_SIZE = 20

export default async function CommunityReviewPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; lang?: string }>
}) {
    const session = await auth()
    if (!session) redirect("/login")
    await requirePermission(session, Feature.CommunityReview)

    const { page: pageStr, lang } = await searchParams
    const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)
    const language = TRANSLATION_LANGUAGES.some((entry) => entry.code === lang) ? lang : undefined

    const db = await init()
    let items, total, byLanguage
    try {
        items = fetchReviewQueue(db, { language, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
        total = countReviewQueue(db, language)
        byLanguage = countReviewQueueByLanguage(db)
    } finally {
        db.close()
    }
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const flagged = await prismaData.contributorStats.findMany({
        where: { flagged: 1 },
        orderBy: { updatedAt: "desc" },
        take: 50,
    })

    // Вторая фаза: пользователи живут в auth.db. Это админка - здесь, в
    // отличие от публичных страниц, email показывать можно (как в /admin/reports).
    const userIds = [...new Set([...items.flatMap((item) => item.votes.map((vote) => vote.userId)), ...flagged.map((row) => row.userId)])]
    const users = userIds.length > 0
        ? await dbAuth.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true } })
        : []
    const userLabels = Object.fromEntries(users.map((user) => [user.id, user.email || user.name || user.id]))

    // Кнопки решения показываем только по языкам, на которые у модератора есть право.
    const languagesInView = [...new Set(items.map((item) => item.language))]
    const writable = Object.fromEntries(await Promise.all(
        languagesInView.map(async (code) => [code, await checkPermission(session, `translate_${code}` as Feature)] as const)
    ))

    const query = (params: { page?: number; lang?: string }) => {
        const search = new URLSearchParams()
        if (params.lang) search.set("lang", params.lang)
        if (params.page && params.page > 1) search.set("page", String(params.page))
        const text = search.toString()
        return text ? `?${text}` : ""
    }

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto w-full overflow-y-auto">
            <div>
                <h1 className="text-xl font-bold">Ответы сообщества</h1>
                <p className="text-sm text-muted-foreground">
                    Переводы, которые волонтёры на карточках <Link href="/contribute" className="text-blue-600">/contribute</Link> отклонили
                    или по которым не сошлись. Согласие «верно» сюда не попадает — оно ставит отметку само.
                </p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
                <Link href={`/admin/community-review${query({})}`} className={`px-3 py-1 rounded-full border ${!language ? "bg-blue-600 text-white border-blue-600" : "border-border"}`}>
                    Все · {Object.values(byLanguage).reduce((sum, count) => sum + count, 0)}
                </Link>
                {TRANSLATION_LANGUAGES.filter((entry) => byLanguage[entry.code]).map((entry) => (
                    <Link
                        key={entry.code}
                        href={`/admin/community-review${query({ lang: entry.code })}`}
                        className={`px-3 py-1 rounded-full border ${language === entry.code ? "bg-blue-600 text-white border-blue-600" : "border-border"}`}
                    >
                        {entry.flag} {entry.name} · {byLanguage[entry.code]}
                    </Link>
                ))}
            </div>

            <CommunityReviewClient items={items} userLabels={userLabels} writable={writable} />

            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm">
                    {page > 1 ? <Link href={`/admin/community-review${query({ lang: language, page: page - 1 })}`} className="text-blue-600">← Назад</Link> : <span />}
                    <span className="text-muted-foreground">Страница {page} из {totalPages}</span>
                    {page < totalPages ? <Link href={`/admin/community-review${query({ lang: language, page: page + 1 })}`} className="text-blue-600">Вперёд →</Link> : <span />}
                </div>
            )}

            <div className="pt-4 border-t space-y-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Провалили контрольные карточки</h2>
                <p className="text-xs text-muted-foreground">
                    Меньше половины верных ответов на 10+ карточках с заранее известным ответом. Вес голоса таких участников уже обнулён автоматически —
                    их ответы в согласие не идут. Список нужен, чтобы заметить накрутку или человека, не понявшего задание.
                </p>
                {flagged.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Никого.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="text-left text-xs text-muted-foreground">
                            <tr><th className="py-1">Участник</th><th>Язык</th><th>Контрольные</th><th>Ответов</th><th>Точность</th></tr>
                        </thead>
                        <tbody>
                            {flagged.map((row) => (
                                <tr key={row.id} className="border-t">
                                    <td className="py-1">{userLabels[row.userId] ?? row.userId}</td>
                                    <td>{row.language}</td>
                                    <td>{row.controlCorrect} / {row.controlTotal}</td>
                                    <td>{row.votesTotal}</td>
                                    <td>{row.accuracy === null ? "—" : `${Math.round(row.accuracy * 100)}%`}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
