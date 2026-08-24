import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prismaAuth as dbAuth, prismaData, prismaCorpus } from "@/lib/prisma"
import { Feature } from "@/config/features"
import { requireRole } from "@/lib/permissions"
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
    // COUNT(DISTINCT ...) вместо groupBy: тот тянул в память по строке на
    // каждый кластер (на живых данных это 77 588 строк) только чтобы взять
    // .length. Prisma не умеет count-distinct, поэтому сырой запрос.
    canSee(Feature.CorpusCandidatesReview)
      ? prismaCorpus
          .$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT clusterKey) AS n FROM "CorpusCandidateProposal" WHERE status = 'pending'`
          .then((rows) => Number(rows[0]?.n ?? 0))
      : Promise.resolve(0),
    // Нет отдельной страницы "все омонимы сразу" - matchCount/resolutionSource
    // проверяются только по одному токену за раз в TokenSidebar.tsx. Считаем
    // честно, ссылка ведёт на список документов, а не на несуществующий
    // единый список.
    //
    // Это НЕ очередь задач: из 786 419 токенов, где два лучших кандидата почти
    // равны, 779 616 (99,1%) спорят о граммеме ОДНОЙ И ТОЙ ЖЕ лексемы — лемма
    // и часть речи уже верны, и разрешается это синтаксическим разбором, а не
    // кликами. Реально требуют человека лишь ~6 800 токенов, где спорят разные
    // лексемы, и большинство из них — дубликаты в словаре. Показываем как
    // показатель качества разметки, а не как список дел.
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
      note: "Показатель качества разметки, не очередь: 99% спорных случаев — граммема одной лексемы, это работа парсера",
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
  )
}
