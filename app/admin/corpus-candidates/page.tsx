import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth, prismaCorpus } from "@/lib/prisma"
import AdminNav from "@/components/AdminNav"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import CorpusCandidatesClient, { ClusterDTO } from "./corpus-candidates-client"

export const metadata: Metadata = {
  title: "Кандидаты из корпуса | Админ-панель",
  description: "Модерация автосгенерированных кандидатов в лексемы из красных/жёлтых токенов корпуса.",
}

const PAGE_SIZE = 20

export default async function CorpusCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.CorpusCandidatesReview)

  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)

  // groupBy не поддерживает count(*) отдельно от _count в SQLite-провайдере
  // Prisma так же удобно, как отдельный запрос — берём общее число кластеров
  // отдельным groupBy без пагинации (эти данные малы: одна строка на
  // clusterKey, не на токен).
  const [allPendingClusters, userPermissions] = await Promise.all([
    prismaCorpus.corpusCandidateProposal.groupBy({
      by: ["clusterKey"],
      where: { status: "pending" },
      _max: { occurrenceCount: true },
      orderBy: { _max: { occurrenceCount: "desc" } },
    }),
    session.user.role === "MODERATOR"
      ? dbAuth.featurePermission
          .findMany({ where: { userId: session.user.id }, select: { featureKey: true } })
          .then((rows) => rows.map((p) => p.featureKey))
      : Promise.resolve([]),
  ])

  const totalClusters = allPendingClusters.length
  const totalPages = Math.max(1, Math.ceil(totalClusters / PAGE_SIZE))
  const pageClusters = allPendingClusters.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const clusterKeys = pageClusters.map((c) => c.clusterKey)

  const proposals = clusterKeys.length > 0
    ? await prismaCorpus.corpusCandidateProposal.findMany({
        where: { clusterKey: { in: clusterKeys }, status: "pending" },
        orderBy: [{ rank: "asc" }],
      })
    : []

  const proposalsByCluster = new Map<string, typeof proposals>()
  for (const p of proposals) {
    const arr = proposalsByCluster.get(p.clusterKey)
    if (arr) arr.push(p)
    else proposalsByCluster.set(p.clusterKey, [p])
  }

  const clusters: ClusterDTO[] = pageClusters.map((c) => ({
    clusterKey: c.clusterKey,
    occurrenceCount: c._max.occurrenceCount ?? 0,
    hypotheses: (proposalsByCluster.get(c.clusterKey) ?? []).map((p) => ({
      id: p.id,
      ruleSource: p.ruleSource,
      guessedPos: p.guessedPos,
      guessedStemType: p.guessedStemType,
      guessedStem: p.guessedStem,
      reconstructedForm: p.reconstructedForm,
      siblingWordSlug: p.siblingWordSlug,
      possibleEndingGap: p.possibleEndingGap,
      exampleTokenIds: p.exampleTokenIds as string[],
    })),
  }))

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
      <CorpusCandidatesClient
        clusters={clusters}
        page={page}
        totalPages={totalPages}
        totalClusters={totalClusters}
      />
    </div>
  )
}
