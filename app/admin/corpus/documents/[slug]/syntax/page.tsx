import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prismaCorpus } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { decodeSlugParam } from "@/lib/slug"
import type { Metadata } from "next"
import SyntaxEditorClient, { type SentenceData } from "./_page"

export const metadata: Metadata = {
  title: "Синтаксический разбор | Админ-панель",
  description: "Просмотр и ручная правка dependency-графа предложений документа.",
}

const PAGE_SIZE = 15

export default async function CorpusSyntaxPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.CorpusSyntaxEdit)

  const { slug: rawSlug } = await params
  const slug = decodeSlugParam(rawSlug)
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)

  const document = await prismaCorpus.corpusDocument.findUnique({
    where: { slug },
    select: { slug: true, title: true },
  })
  if (!document) notFound()

  const totalSentences = await prismaCorpus.corpusSentence.count({ where: { documentSlug: slug } })
  const totalPages = Math.max(1, Math.ceil(totalSentences / PAGE_SIZE))

  const sentences = await prismaCorpus.corpusSentence.findMany({
    where: { documentSlug: slug },
    orderBy: { position: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      position: true,
      rawText: true,
      tokens: {
        orderBy: { tokenIndex: "asc" },
        select: { id: true, tokenIndex: true, surfaceForm: true, pos: true },
      },
      dependencies: {
        select: { depTokenId: true, headTokenId: true, relation: true, confidence: true, source: true },
      },
    },
  })

  const sentenceData: SentenceData[] = sentences.map(s => ({
    id: s.id,
    position: s.position,
    rawText: s.rawText,
    tokens: s.tokens.map(t => ({
      id: t.id.toString(),
      tokenIndex: t.tokenIndex,
      surfaceForm: t.surfaceForm,
      pos: t.pos,
    })),
    edges: s.dependencies.map(e => ({
      depTokenId: e.depTokenId.toString(),
      headTokenId: e.headTokenId?.toString() ?? null,
      relation: e.relation,
      confidence: e.confidence,
      source: e.source,
    })),
  }))

  return (
    <SyntaxEditorClient
      documentSlug={document.slug}
      documentTitle={document.title}
      sentences={sentenceData}
      page={page}
      totalPages={totalPages}
    />
  )
}
