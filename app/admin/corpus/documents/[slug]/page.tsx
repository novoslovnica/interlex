import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { notFound } from "next/navigation"
import { prismaCorpus } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import CorpusDocumentEditPage from "./_page"

export const metadata: Metadata = {
  title: "Редактирование документа | Админ-панель",
  description: "Просмотр и редактирование документа корпуса.",
}

const CorpusDocumentPageWrapper = async ({
  params,
}: {
  params: Promise<{ slug: string }>
}) => {
  const session = await auth()
  if (!session) redirect("/login")

  await requirePermission(session, Feature.CorpusBuilder)

  const { slug } = await params

  const document = await prismaCorpus.corpusDocument.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      author: true,
      rawText: true,
      language: true,
      createdAt: true,
      candidatesProcessed: true,
      _count: {
        select: {
          tokens: true,
          sentences: true,
          segments: true,
        },
      },
    },
  })

  if (!document) notFound()

  const totalTokens = document._count.tokens

  const [punctCount, oovCount] = await Promise.all([
    prismaCorpus.corpusToken.count({
      where: { documentSlug: slug, wordIndex: -1 },
    }),
    prismaCorpus.corpusToken.count({
      where: { documentSlug: slug, wordIndex: { gte: 0 }, pos: "X", wordSlug: null },
    }),
  ])

  const nonPunctTokens = totalTokens - punctCount
  const oovRate = nonPunctTokens > 0 ? Math.round((oovCount / nonPunctTokens) * 100) : 0
  const punctDensity = totalTokens > 0 ? Math.round((punctCount / totalTokens) * 100) : 0

  const whitespaceWords = document.rawText
    .split(/\s+/)
    .filter((w) => w.length > 0).length

  return (
    <CorpusDocumentEditPage
      document={document}
      metrics={{
        oovRate,
        oovCount,
        punctDensity,
        punctCount,
        nonPunctTokens,
        whitespaceWords,
      }}
    />
  )
}

export default CorpusDocumentPageWrapper