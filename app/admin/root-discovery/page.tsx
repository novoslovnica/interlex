import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaData } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import RootDiscoveryClient, { type ProposalDTO } from "./root-discovery-client"

export const metadata: Metadata = {
  title: "Новые корни (кандидаты) | Админ-панель",
  description: "Модерация автопредложенных новых корней из кластеризации непривязанных слов.",
}

const PAGE_SIZE = 20

export default async function RootDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.RootDiscoveryReview)

  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)

  const [total, proposals] = await Promise.all([
    prismaData.rootDiscoveryProposal.count({ where: { status: "pending" } }),
    prismaData.rootDiscoveryProposal.findMany({
      where: { status: "pending" },
      orderBy: [{ occurrenceCount: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { protoSuggestion: { select: { id: true, lemma: true } } },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const dtos: ProposalDTO[] = proposals.map((p) => ({
    id: p.id,
    clusterKey: p.clusterKey,
    proposedValue: p.proposedValue,
    method: p.method,
    strippedPrefix: p.strippedPrefix,
    strippedSuffix: p.strippedSuffix,
    occurrenceCount: p.occurrenceCount,
    exampleLexemeIds: p.exampleLexemeIds as { id: number; value: string }[],
    protoSuggestion: p.protoSuggestion,
    protoSuggestionScore: p.protoSuggestionScore,
  }))

  return (
    <RootDiscoveryClient proposals={dtos} page={page} totalPages={totalPages} total={total} />
  )
}
