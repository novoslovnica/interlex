import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prismaAuth as dbAuth, prismaData, prismaCorpus } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requireRole } from "@/lib/permissions"
import AdminNav from "@/components/AdminNav"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Панель модератора — администрирование",
  description: "Сводка по всем очередям на ревью (roadmap п.48).",
}

interface QueueTile {
  key: string
  label: string
  href: string
  feature: Feature
  count: number | null // null = у этой очереди нет дешёвого агрегированного счётчика
  note?: string
}

export default async function ModerationDashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")
  await requireRole(session, ["ADMIN", "MODERATOR"])

  const userPermissions = session.user.role === "MODERATOR"
    ? (await dbAuth.featurePermission.findMany({
        where: { userId: session.user.id },
        select: { featureKey: true },
      })).map((p) => p.featureKey)
    : []

  const canSee = (feature: Feature) => session.user.role === "ADMIN" || userPermissions.includes(feature)

  // Параллельно, чтобы не сериализовать 4 независимых count-запроса по 2
  // разным БД (data.db, corpus.db) - каждый дешёвый сам по себе.
  const [candidatesPending, corpusClusters, corpusHomonyms, suggestionsPending, reportsPending] = await Promise.all([
    canSee(Feature.CandidatesPromote) ? prismaData.candidate.count({ where: { promotedAt: null } }) : Promise.resolve(0),
    canSee(Feature.CorpusCandidatesReview)
      ? prismaCorpus.corpusCandidateProposal.groupBy({ by: ["clusterKey"], where: { status: "pending" } }).then((rows) => rows.length)
      : Promise.resolve(0),
    // Нет отдельной страницы "все омонимы сразу" - matchCount/resolutionSource
    // проверяются только по одному токену за раз в TokenSidebar.tsx. Считаем
    // честно, ссылка ведёт на список документов, а не на несуществующий
    // единый список.
    canSee(Feature.CorpusTokenDisambiguate)
      ? prismaCorpus.corpusToken.count({ where: { matchCount: { gt: 1 }, resolutionSource: "auto" } })
      : Promise.resolve(0),
    canSee(Feature.SuggestionsReview) ? prismaData.wordSuggestion.count({ where: { status: "pending" } }) : Promise.resolve(0),
    canSee(Feature.ReportsReview) ? prismaData.contentReport.count({ where: { status: "pending" } }) : Promise.resolve(0),
  ])

  const allTiles: QueueTile[] = [
    { key: "candidates", label: "Кандидаты", href: "/admin/candidates", feature: Feature.CandidatesPromote, count: candidatesPending },
    { key: "corpus-candidates", label: "Кандидаты из корпуса", href: "/admin/corpus-candidates", feature: Feature.CorpusCandidatesReview, count: corpusClusters },
    {
      key: "corpus-homonyms",
      label: "Омонимия корпуса",
      href: "/admin/corpus/documents",
      feature: Feature.CorpusTokenDisambiguate,
      count: corpusHomonyms,
      note: "Разбор по документам — единого списка токенов нет",
    },
    { key: "suggestions", label: "Предложенные слова", href: "/admin/suggestions", feature: Feature.SuggestionsReview, count: suggestionsPending },
    { key: "reports", label: "Жалобы на ошибки", href: "/admin/reports", feature: Feature.ReportsReview, count: reportsPending },
    {
      key: "deduplication",
      label: "Дедупликация",
      href: "/admin/deduplication",
      feature: Feature.DeduplicationManage,
      count: null,
      note: "Список схожести считается на лету — без счётчика",
    },
  ]

  const tiles = allTiles.filter((t) => canSee(t.feature))

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
      <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
        <h1 className="text-xl font-bold">Панель модератора</h1>

        {tiles.length === 0 && (
          <p className="text-sm text-muted-foreground">У вас нет прав ни на одну из очередей ревью.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((tile) => (
            <Link
              key={tile.key}
              href={tile.href}
              className="border rounded-xl p-4 flex flex-col gap-2 hover:border-primary transition-colors bg-muted/20"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{tile.label}</span>
                {tile.count !== null && (
                  <span className={`text-2xl font-bold ${tile.count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    {tile.count}
                  </span>
                )}
              </div>
              {tile.note && <span className="text-xs text-muted-foreground">{tile.note}</span>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
