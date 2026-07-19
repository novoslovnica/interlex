import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { notFound } from "next/navigation"
import { prismaCorpus } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import CorpusSegmentsPage from "./_page"

export const metadata: Metadata = {
  title: "Сегменты документа | Админ-панель",
  description: "Просмотр сегментов (абзацев) документа корпуса.",
}

const CorpusSegmentsPageWrapper = async ({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string; q?: string }>
}) => {
  const session = await auth()
  if (!session) redirect("/login")

  await requirePermission(session, Feature.CorpusBuilder)

  const { slug } = await params
  const { page: pageStr, q } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)
  const pageSize = 20

  const doc = await prismaCorpus.corpusDocument.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true },
  })
  if (!doc) notFound()

  const where = {
    documentSlug: slug,
    ...(q ? { rawText: { contains: q } } : {}),
  } as const

  const [totalCount, segments] = await Promise.all([
    prismaCorpus.corpusSegment.count({ where }),
    prismaCorpus.corpusSegment.findMany({
      where,
      orderBy: { position: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        position: true,
        rawText: true,
        _count: { select: { sentences: true } },
      },
    }),
  ])

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <CorpusSegmentsPage
      document={{ title: doc.title, slug: doc.slug }}
      segments={segments.map((s) => ({
        id: s.id,
        position: s.position,
        rawText: s.rawText,
        sentenceCount: s._count.sentences,
      }))}
      currentPage={page}
      totalPages={totalPages}
      query={q ?? ""}
    />
  )
}

export default CorpusSegmentsPageWrapper