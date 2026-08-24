import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Prisma } from "@/prisma/generated/corpus/client"
import { prismaCorpus } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import CorpusCandidatesClient, { ClusterDTO, QueueKey } from "./corpus-candidates-client"

export const metadata: Metadata = {
  title: "Кандидаты из корпуса | Админ-панель",
  description: "Модерация автосгенерированных кандидатов в лексемы из красных/жёлтых токенов корпуса.",
}

const PAGE_SIZE = 20

// Очередь определяется свойствами КЛАСТЕРА, а не отдельной гипотезы: у одного
// слова могут быть и гипотезы с признаком пробела в парадигме, и обычные
// (77 588 кластеров в работе против 80 783 сочетаний). Поэтому фильтр —
// HAVING по агрегату, а не WHERE по строке.
const QUEUES: Record<QueueKey, { status: string; gap: 0 | 1 | null; title: string; hint: string }> = {
  words: {
    status: "pending",
    gap: 0,
    title: "Новые слова",
    hint: "Слова, которых нет в словаре. Одобрение создаёт запись в «Кандидатах» для дальнейшей проверки.",
  },
  endings: {
    status: "pending",
    gap: 1,
    title: "Пробелы в парадигмах",
    hint:
      "Это НЕ новые слова: основа совпала с уже существующей лексемой, а форму движок не порождает — " +
      "значит дело в окончаниях этой лексемы, и чинить надо в /admin/endings, а не заводить дубликат.",
  },
  deferred: {
    status: "deferred",
    gap: null,
    title: "Отложенные",
    hint:
      "Слова, встретившиеся в корпусе слишком редко, чтобы тратить на них ревью. Не отклонены: " +
      "при следующей перегенерации вернутся в очередь сами, если наберут вхождения.",
  },
}

interface ClusterRow {
  clusterKey: string
  occurrenceCount: number
  gap: number
}

function clusterFilter(status: string, gap: 0 | 1 | null): Prisma.Sql {
  return gap === null
    ? Prisma.sql`WHERE status = ${status} GROUP BY clusterKey`
    : Prisma.sql`WHERE status = ${status} GROUP BY clusterKey HAVING MAX(possibleEndingGap) = ${gap}`
}

export default async function CorpusCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; queue?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.CorpusCandidatesReview)

  const { page: pageStr, queue: queueStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)
  const queue: QueueKey = queueStr === "endings" || queueStr === "deferred" ? queueStr : "words"
  const config = QUEUES[queue]

  // Раньше страница вытягивала groupBy по ВСЕМ кластерам очереди в память и
  // резала срез уже в JS — на 186 тысячах кластеров это гарантированная
  // деградация. Теперь и счётчики, и срез считаются в SQLite.
  const counts = await Promise.all(
    (Object.keys(QUEUES) as QueueKey[]).map(async (key) => {
      const q = QUEUES[key]
      const rows = await prismaCorpus.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*) AS n FROM (
          SELECT clusterKey FROM "CorpusCandidateProposal" ${clusterFilter(q.status, q.gap)}
        )`
      return [key, Number(rows[0]?.n ?? 0)] as const
    }),
  )
  const queueCounts = Object.fromEntries(counts) as Record<QueueKey, number>

  const totalClusters = queueCounts[queue]
  const totalPages = Math.max(1, Math.ceil(totalClusters / PAGE_SIZE))
  const offset = (page - 1) * PAGE_SIZE

  const clusterRows = await prismaCorpus.$queryRaw<ClusterRow[]>`
    SELECT clusterKey, MAX(occurrenceCount) AS occurrenceCount, MAX(possibleEndingGap) AS gap
    FROM "CorpusCandidateProposal"
    ${clusterFilter(config.status, config.gap)}
    ORDER BY occurrenceCount DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}`

  const clusterKeys = clusterRows.map((c) => c.clusterKey)

  const proposals = clusterKeys.length > 0
    ? await prismaCorpus.corpusCandidateProposal.findMany({
        where: { clusterKey: { in: clusterKeys }, status: config.status },
        orderBy: [{ rank: "asc" }],
      })
    : []

  const proposalsByCluster = new Map<string, typeof proposals>()
  for (const p of proposals) {
    const arr = proposalsByCluster.get(p.clusterKey)
    if (arr) arr.push(p)
    else proposalsByCluster.set(p.clusterKey, [p])
  }

  const clusters: ClusterDTO[] = clusterRows.map((c) => ({
    clusterKey: c.clusterKey,
    occurrenceCount: c.occurrenceCount,
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
    <CorpusCandidatesClient
      clusters={clusters}
      page={page}
      totalPages={totalPages}
      totalClusters={totalClusters}
      queue={queue}
      queueCounts={queueCounts}
      queueTitle={config.title}
      queueHint={config.hint}
    />
  )
}
