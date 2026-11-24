import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { Feature } from "@/config/features"
import { findSuffixCandidates, hasAdjectiveStemMismatch } from "@/lib/lexicon/adjectiveQuality"
import { checkPermission, requirePermission } from "@/lib/permissions"
import { prismaData } from "@/lib/prisma"
import { MorphemeType } from "@/lib/grammar/common/morpheme"
import { PosType } from "@/lib/grammar/common/pos"
import type { Prisma } from "@/prisma/generated/data/client"

export const metadata: Metadata = { title: "Качество словаря" }

const PATH = "/admin/dashboard/lexicon-quality"
const PAGE_SIZE = 30
const VIEWS = [
    { id: "suffixes", label: "Суффиксы для проверки" },
    { id: "missing-meaning", label: "Без значений" },
    { id: "missing-pos", label: "Без части речи" },
    { id: "stem", label: "Расхождение формы и основы" },
] as const
type View = typeof VIEWS[number]["id"]

const fields = { id: true, slug: true, value: true, stem: true, pos: true } as const
const orderBy = [{ value: "asc" }, { id: "asc" }] satisfies Prisma.LexemeOrderByWithRelationInput[]

async function loadReport(view: View, page: number) {
    const skip = (page - 1) * PAGE_SIZE
    if (view === "missing-pos" || view === "missing-meaning") {
        const where: Prisma.LexemeWhereInput = view === "missing-pos"
            ? { OR: [{ pos: null }, { pos: "" }] }
            : { meanings: { none: { meaning: { not: "" }, NOT: { meaning: null } } } }
        const [total, entries] = await Promise.all([
            prismaData.lexeme.count({ where }),
            prismaData.lexeme.findMany({ where, select: fields, orderBy, skip, take: PAGE_SIZE }),
        ])
        return { total, rows: entries.map((entry) => ({ ...entry, candidates: [] })) }
    }

    const adjectives = await prismaData.lexeme.findMany({
        where: { pos: PosType.ADJ, isCollocation: false },
        select: {
            ...fields,
            lexemes_morphemes: {
                where: { morpheme: { type: { in: [MorphemeType.ROOT, MorphemeType.SUFFIX] } } },
                select: { morpheme: { select: { value: true, type: true } } },
            },
        },
        orderBy,
    })
    const rows = adjectives.flatMap(({ lexemes_morphemes, ...entry }) => {
        const candidates = view === "suffixes"
            ? findSuffixCandidates(entry, lexemes_morphemes.flatMap(({ morpheme }) => morpheme ?? []))
            : []
        const matches = view === "suffixes" ? candidates.length > 0 : hasAdjectiveStemMismatch(entry)
        return matches ? [{ ...entry, candidates }] : []
    })
    return { total: rows.length, rows: rows.slice(skip, skip + PAGE_SIZE) }
}

function reportUrl(view: View, page = 1) {
    return `${PATH}?view=${view}${page > 1 ? `&page=${page}` : ""}`
}

export default async function LexiconQualityPage({
    searchParams,
}: {
    searchParams: Promise<{ view?: string; page?: string }>
}) {
    const session = await auth()
    if (!session) redirect("/login")
    await requirePermission(session, Feature.WordsEdit)

    const params = await searchParams
    const view = VIEWS.find(({ id }) => id === params.view)?.id ?? "suffixes"
    const requestedPage = Number(params.page ?? "1")
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
        && requestedPage <= Math.floor(Number.MAX_SAFE_INTEGER / PAGE_SIZE) ? requestedPage : 1
    const [{ rows, total }, canReviewDuplicates] = await Promise.all([
        loadReport(view, page),
        checkPermission(session, Feature.DeduplicationManage),
    ])
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
    if (page > lastPage) redirect(reportUrl(view, lastPage))

    return (
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-5xl space-y-4 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-primary">
                <Link href="/admin/dashboard" className="text-sm text-primary underline underline-offset-4">
                    Панель модератора
                </Link>
                <h1 className="text-2xl font-bold">Качество словаря</h1>
                <nav aria-label="Разделы отчёта" className="flex flex-wrap items-center gap-2 text-sm">
                    {VIEWS.map(({ id, label }) => (
                        <Link key={id} href={reportUrl(id)} aria-current={view === id ? "page" : undefined}
                            className={`rounded-lg border px-3 py-1.5 ${view === id ? "bg-primary text-primary-foreground dark:bg-blue-700" : "hover:bg-muted"}`}>
                            {label}
                        </Link>
                    ))}
                    {canReviewDuplicates && (
                        <Link href="/admin/deduplication" className="px-3 py-1.5 text-primary underline underline-offset-4">
                            Кандидаты в дубли
                        </Link>
                    )}
                </nav>
                {view === "suffixes" && (
                    <p className="text-sm text-muted-foreground">
                        Кандидаты отобраны по написанию прилагательного. Проверьте строение слова и привяжите подтверждённый суффикс в разделе «Состав слова» карточки.
                    </p>
                )}
                {view === "stem" && (
                    <p className="text-sm text-muted-foreground">
                        Прилагательные, у которых после свёртки диакритики основа расходится со словарной формой даже без окончания.
                    </p>
                )}
                <p className="text-sm tabular-nums text-muted-foreground">Всего записей · {total}</p>
                {rows.length === 0 ? (
                    <p className="rounded-lg border p-4 text-sm text-muted-foreground">Записей для проверки нет.</p>
                ) : (
                    <div role="region" aria-label={VIEWS.find(({ id }) => id === view)?.label}
                        tabIndex={0} className="overflow-x-auto rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/60">
                                <tr>
                                    <th scope="col" className="p-3">Лексема</th>
                                    <th scope="col" className="p-3">Основа</th>
                                    <th scope="col" className="p-3 whitespace-nowrap">Часть речи</th>
                                    {view === "suffixes" && <th scope="col" className="p-3">Кандидат</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {rows.map(({ id, value, slug, stem, pos, candidates }) => (
                                    <tr key={id}>
                                        <th scope="row" className="p-3 font-medium">
                                            <Link href={`/admin/words/${id}/edit${candidates.length ? `?morpheme=${candidates[0]}#morphemes` : ""}`}
                                                className="text-primary underline underline-offset-4">
                                                {value || slug}
                                            </Link>
                                        </th>
                                        <td className="p-3">{stem || "—"}</td>
                                        <td className="p-3">{pos || "—"}</td>
                                        {view === "suffixes" && (
                                            <td className="p-3 font-mono">{candidates.map((suffix) => `-${suffix}-`).join(", ")}</td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {lastPage > 1 && (
                    <nav aria-label="Страницы отчёта" className="flex items-center gap-4 text-sm">
                        {page > 1 && <Link className="underline" href={reportUrl(view, page - 1)}>Назад</Link>}
                        <span>{page} / {lastPage}</span>
                        {page < lastPage && <Link className="underline" href={reportUrl(view, page + 1)}>Дальше</Link>}
                    </nav>
                )}
            </div>
        </main>
    )
}
