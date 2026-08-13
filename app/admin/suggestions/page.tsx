import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth, prismaData } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import SuggestionsClient, { SuggestionDTO } from "./suggestions-client"

export const metadata: Metadata = {
  title: "Предложенные слова | Админ-панель",
  description: "Модерация публичных заявок 'предложить слово'.",
}

const PAGE_SIZE = 20

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.SuggestionsReview)

  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)

  const [suggestions, total] = await Promise.all([
    prismaData.wordSuggestion.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prismaData.wordSuggestion.count({ where: { status: "pending" } }),
  ])

  const submitterIds = [...new Set(suggestions.map((s) => s.submitterUserId).filter((id): id is string => !!id))]
  const submitters = submitterIds.length > 0
    ? await dbAuth.user.findMany({ where: { id: { in: submitterIds } }, select: { id: true, email: true, name: true } })
    : []
  const submitterById = new Map(submitters.map((u) => [u.id, u.email || u.name || u.id]))

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const dtos: SuggestionDTO[] = suggestions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    suggestedValue: s.suggestedValue,
    meaningText: s.meaningText,
    exampleSentence: s.exampleSentence,
    sourceNote: s.sourceNote,
    submitter: s.submitterUserId ? (submitterById.get(s.submitterUserId) ?? s.submitterUserId) : (s.submitterContact ?? null),
  }))

  return <SuggestionsClient suggestions={dtos} page={page} totalPages={totalPages} total={total} />
}
