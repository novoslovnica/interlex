import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaHistorical, prismaData } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import HistoricalAttestationsClient, { AttestationDTO } from "./historical-attestations-client"

export const metadata: Metadata = {
  title: "Исторические аттестации | Админ-панель",
  description: "Модерация автосопоставлений слов из исторических корпусов с лексемами.",
}

const PAGE_SIZE = 20
const BRANCH_LABEL: Record<string, string> = { east: "Восточнослав.", south: "Старославянская", balkan: "Балканослав." }

export default async function HistoricalAttestationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; branch?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.HistoricalAttestationsReview)

  const { page: pageStr, branch } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)
  const where = { status: "proposed", ...(branch ? { branch } : {}) }

  const totalCount = await prismaHistorical.historicalAttestation.count({ where })
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const attestations = await prismaHistorical.historicalAttestation.findMany({
    where,
    orderBy: { occurrenceCount: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })

  // historical.db и interlex.db — разные БД, join невозможен и не нужен
  // (см. AGENTS.md "Historical Corpora") — дотягиваем лексемы отдельным
  // запросом и мержим в коде, тот же паттерн, что и у CorpusToken.wordSlug.
  const lexIds = [...new Set(attestations.map((a) => a.lexemeId))]
  const lexemes = lexIds.length
    ? await prismaData.lexeme.findMany({ where: { id: { in: lexIds } }, select: { id: true, slug: true, value: true, stem: true, proto: true, pos: true } })
    : []
  const lexById = new Map(lexemes.map((l) => [l.id, l]))

  const allTokenIds = attestations.flatMap((a) => (a.exampleTokenIds as string[]).map((id) => BigInt(id)))
  const tokens = allTokenIds.length
    ? await prismaHistorical.historicalToken.findMany({
        where: { id: { in: allTokenIds } },
        select: { id: true, form: true, sentence: { select: { rawText: true } }, document: { select: { title: true } } },
      })
    : []
  const tokenById = new Map(tokens.map((t) => [t.id.toString(), t]))

  const dtos: AttestationDTO[] = attestations.map((a) => {
    const l = lexById.get(a.lexemeId)
    return {
      id: a.id,
      branch: a.branch,
      branchLabel: BRANCH_LABEL[a.branch] ?? a.branch,
      historicalLemma: a.historicalLemma,
      matchMethod: a.matchMethod,
      confidence: a.confidence,
      occurrenceCount: a.occurrenceCount,
      lexeme: l ? { id: l.id, slug: l.slug, value: l.value, stem: l.stem, proto: l.proto, pos: l.pos } : null,
      examples: (a.exampleTokenIds as string[])
        .map((id) => tokenById.get(id))
        .filter((t): t is NonNullable<typeof t> => !!t)
        .map((t) => ({ form: t.form, sentenceText: t.sentence.rawText, documentTitle: t.document.title })),
    }
  })

  return (
    <HistoricalAttestationsClient
      attestations={dtos}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
      currentBranch={branch}
    />
  )
}
