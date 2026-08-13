import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { requireRole } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Админ-панель",
  description: "Главная страница администрирования — навигация по всем разделам.",
}

interface HomeLink {
  href: string
  label: string
  feature?: Feature
  adminOnly?: boolean
}

interface HomeSection {
  title: string
  links: HomeLink[]
}

// Deliberately query-free (unlike /admin/dashboard, which is the one place
// allowed to be heavy) - this is the landing screen every ADMIN/MODERATOR
// hits first, so it stays cheap no matter how many pending items exist.
// Mirrors AdminNav's grouping 1:1 so the two don't drift into different
// mental models of "what sections exist."
const SECTIONS: HomeSection[] = [
  {
    title: "Тезаурус",
    links: [
      { href: "/admin/translations", label: "Переводы", feature: Feature.DictionaryEdit },
      { href: "/admin/translation-cards", label: "Переводы (карточки)", feature: Feature.DictionaryEdit },
      { href: "/admin/word-cards", label: "Слова (карточки)", feature: Feature.WordsEdit },
      { href: "/admin/synonyms", label: "Синонимы", feature: Feature.SynonymsEdit },
      { href: "/admin/antonyms", label: "Антонимы", feature: Feature.AntonymsEdit },
      { href: "/admin/primes", label: "Праймы", feature: Feature.SemanticPrimesManage },
      { href: "/admin/core-vocabulary", label: "Базовая лексика", feature: Feature.CoreVocabularyManage },
      { href: "/admin/roots", label: "Корни", feature: Feature.RootsEdit },
      { href: "/admin/roots/words", label: "Слова корней", feature: Feature.RootsEdit },
      { href: "/admin/endings", label: "Окончания", feature: Feature.EndingsEdit },
      { href: "/admin/verb-government", label: "Управление глаголов", feature: Feature.VerbGovernmentEdit },
    ],
  },
  {
    title: "Отношения",
    links: [
      { href: "/admin/relations/hypernyms", label: "Гиперонимы", feature: Feature.HypernymsEdit },
      { href: "/admin/relations/hyponyms", label: "Гипонимы", feature: Feature.HyponymsEdit },
      { href: "/admin/relations/meronyms", label: "Меронимы", feature: Feature.MeronymsEdit },
      { href: "/admin/relations/holonyms", label: "Холонимы", feature: Feature.HolonymsEdit },
      { href: "/admin/relations/related-words", label: "Связанные", feature: Feature.RelatedWordsEdit },
      { href: "/admin/relations/causes", label: "Причины", feature: Feature.CausesEdit },
      { href: "/admin/relations/effects", label: "Следствия", feature: Feature.EffectsEdit },
      { href: "/admin/relations/premises", label: "Предпосылки", feature: Feature.PremisesEdit },
      { href: "/admin/relations/conclusions", label: "Заключения", feature: Feature.ConclusionsEdit },
      { href: "/admin/relations/pos-synonyms", label: "Кросс-частеречные синонимы", feature: Feature.PosSynonymsEdit },
      { href: "/admin/relations/instance-of", label: "Экземпляр класса", feature: Feature.InstanceOfEdit },
      { href: "/admin/relations/instances", label: "Экземпляры класса", feature: Feature.InstancesEdit },
      { href: "/admin/relations/derivation-targets", label: "Дериваты", feature: Feature.DerivationTargetsEdit },
      { href: "/admin/relations/derivation-sources", label: "Источники деривации", feature: Feature.DerivationSourcesEdit },
    ],
  },
  {
    title: "Очереди",
    links: [
      { href: "/admin/candidates", label: "Кандидаты", feature: Feature.CandidatesPromote },
      { href: "/admin/corpus-candidates", label: "Кандидаты из корпуса", feature: Feature.CorpusCandidatesReview },
      { href: "/admin/suggestions", label: "Предложенные слова", feature: Feature.SuggestionsReview },
      { href: "/admin/reports", label: "Жалобы на ошибки", feature: Feature.ReportsReview },
      { href: "/admin/deduplication", label: "Дедупликация", adminOnly: true },
    ],
  },
  {
    title: "Корпус",
    links: [
      { href: "/admin/corpus/builder", label: "Конструктор", feature: Feature.CorpusBuilder },
      { href: "/admin/corpus/documents", label: "Документы", feature: Feature.CorpusBuilder },
      { href: "/admin/corpus/import", label: "Импорт", feature: Feature.CorpusBuilder },
      { href: "/admin/corpus/semantic-field", label: "Семантическое поле", feature: Feature.CorpusBuilder },
    ],
  },
  {
    title: "Платформа",
    links: [
      { href: "/admin/platform/library", label: "Библиотека", feature: Feature.LibraryManage },
      { href: "/admin/platform/media", label: "Медиатека", feature: Feature.MediaLibraryManage },
      { href: "/admin/platform/users", label: "Пользователи", adminOnly: true },
      { href: "/admin/platform/audit-log", label: "Аудит", feature: Feature.LogsView },
      { href: "/admin/platform/api-keys", label: "API-ключи", feature: Feature.ApiKeysManage },
    ],
  },
]

export default async function AdminHomePage() {
  const session = await auth()
  if (!session) redirect("/login")
  await requireRole(session, ["ADMIN", "MODERATOR"])

  const isAdmin = session.user.role === "ADMIN"
  const userPermissions = !isAdmin
    ? (await dbAuth.featurePermission.findMany({
        where: { userId: session.user.id },
        select: { featureKey: true },
      })).map((p) => p.featureKey)
    : []

  const canSee = (link: HomeLink) => {
    if (isAdmin) return !link.adminOnly || isAdmin
    if (link.adminOnly) return false
    return !!link.feature && userPermissions.includes(link.feature)
  }

  const visibleSections = SECTIONS
    .map((section) => ({ ...section, links: section.links.filter(canSee) }))
    .filter((section) => section.links.length > 0)

  return (
    <div className="flex-1 min-h-0 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Админ-панель</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {session.user.name || session.user.email}, {isAdmin ? "администратор" : "модератор"}
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="px-4 py-2 text-sm font-medium rounded-lg border bg-muted/30 hover:bg-muted transition-colors"
        >
          Что ждёт ревью — Дашборд →
        </Link>
      </div>

      {visibleSections.length === 0 && (
        <p className="text-sm text-muted-foreground">У вас пока нет прав ни на один раздел админки.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleSections.map((section) => (
          <div key={section.title} className="border rounded-xl p-4 bg-muted/10">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">{section.title}</h2>
            <div className="flex flex-wrap gap-2">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 text-sm rounded-lg border bg-background hover:border-primary hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
