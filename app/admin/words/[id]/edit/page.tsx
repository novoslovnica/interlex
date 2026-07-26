import { prismaAuth as dbAuth, prismaData as db } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { type Prisma } from "@/prisma/generated/data/client"
import ArticleForm from "@/components/ArticleForm"
import type { Metadata } from "next"
import { auth } from "@/auth"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { generateStemCandidates } from "@/lib/grammar/common/stem-candidates"
import { init } from "@/lib/sqlite"
import AdminNav from "@/components/AdminNav"
import { RelationsTab } from "./_components/relations-tab"
import { updateWord } from "@/lib/actions/word-actions"
import { fetchSymmetricSemanticRelations, fetchOutgoingSemanticRelations, fetchIncomingSemanticRelations } from "@/lib/relations"
import { fetchTranslationsForMeaningIds } from "@/lib/translations"
import { RELATION_CONFIG } from "../../../relations/relation-config"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const word = await db.lexeme.findUnique({ where: { id: parseInt(id, 10) }, select: { value: true } })
  return {
    title: `Редактирование: ${word?.value ?? id}`,
    description: `Редактирование словарной статьи «${word?.value ?? id}» в базе межславянского лексикона.`,
  }
}

const rootSelectStructure = {
  id: true,
  value: true,
  lexemes_morphemes: {
    take: 10,
    select: {
      id: true,
      lexeme: {
        select: {
          id: true,
          value: true,
        },
      },
    },
  },
} as const

export type MorphemeWithLexemes = Prisma.MorphemeGetPayload<{
  select: typeof rootSelectStructure
}>

interface EditPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

function extractTranslations(
  byLang: Record<string, Record<number, { id: number; value: string | null; verified: number | null; message: string | null }[]>>,
  meaningId: number
): Record<string, { id: number; value: string; verified: number; message: string }[]> {
  const result: Record<string, { id: number; value: string; verified: number; message: string }[]> = {}
  for (const lang of Object.keys(byLang)) {
    const rows = byLang[lang][meaningId] ?? []
    result[lang] = rows
      .filter((t) => t.value?.trim())
      .map((t) => ({ id: t.id, value: t.value ?? "", verified: t.verified ?? 0, message: t.message ?? "" }))
  }
  return result
}

export default async function EditArticlePage({ params, searchParams }: EditPageProps) {
  const { id } = await params
  const { tab } = await searchParams
  const activeTab = tab === "relations" ? "relations" : "article"
  const wordId = parseInt(id, 10)

  if (isNaN(wordId)) notFound()

  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.WordsEdit)

  const [wordData, initialRoots] = await Promise.all([
    db.lexeme.findUnique({
      where: { id: wordId },
      include: {
        meanings: {
          include: {
            valencyFrames: {
              include: { arguments: { orderBy: { sortOrder: "asc" } } },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        lexemes_morphemes: {
          take: 1,
          select: {
            morphemeId: true,
            morpheme: {
              select: { value: true },
            },
          },
        },
        anomalies: true,
        lexemeAllophones: {
          include: { flavor: true },
        },
      },
    }),
    db.morpheme.findMany({
      select: rootSelectStructure,
      orderBy: { value: "asc" },
      take: 30,
    }) as Promise<MorphemeWithLexemes[]>,
  ])

  if (!wordData) notFound()

  const dbSimple = await init()
  const meaningIdsForTranslations = (wordData.meanings || []).map((m) => m.id)
  const translationsByLang = fetchTranslationsForMeaningIds(dbSimple, meaningIdsForTranslations)

  const currentAnomalies = (wordData.anomalies || []).map((a) => ({
    inflection: a.inflection,
    grammeme: a.grammeme,
  }))

const attachedRoots = (wordData.lexemes_morphemes || [])
    .map((rw) => rw.morpheme)
    .filter((r): r is { id: number; value: string } => !!r && !!r.value)

  // Derive homonym base keys from stem using same heuristic as seed scripts
  const stemCandidates = wordData.stem
    ? generateStemCandidates({
        stem: wordData.stem,
        secondaryStem: wordData.secondaryStem || null,
        tertiaryStem: wordData.tertiaryStem || null,
        isv: wordData.value,
        pos: wordData.pos,
      })
    : []

  // Fetch existing base_homonyms where this word's id appears
  const baseHomonyms = stemCandidates.length > 0
    ? await db.baseHomonym.findMany({
        where: { base: { in: stemCandidates } },
      })
    : []

  const initialHomonymBases = baseHomonyms.map((h) => {
    let flavor = "CORE"
    try {
      const parsed = JSON.parse(h.wordIds)
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null) {
        const found = (parsed as Array<{ id: number; flavor?: string }>).find((item) => item.id === wordId)
        if (found) flavor = found.flavor || "CORE"
      }
    } catch {}
    return { base: h.base, flavor }
  })

  const allophones = (wordData.lexemeAllophones || []).reduce<Record<string, string>>(
  (acc, a) => {
    acc[a.flavor.code.toLowerCase()] = a.value
    return acc
  },
  { core: "", nsl: "", east: "", west: "", south: "" }
)

  const meanings = (wordData.meanings || []).map((m) => ({
    id: m.id,
    meaning: m.meaning ?? "",
    examples: m.examples ?? "",
    meaningVerified: m.meaningVerified ?? 0,
    meaningMessage: m.meaningMessage ?? "",
    examplesVerified: m.examplesVerified ?? 0,
    examplesMessage: m.examplesMessage ?? "",
    translations: extractTranslations(translationsByLang, m.id),
    valencyFrames: m.valencyFrames.map((f) => ({
      id: f.id,
      label: f.label ?? "",
      arguments: f.arguments.map((a) => ({
        id: a.id,
        case: a.case,
        preposition: a.preposition ?? "",
        role: a.role ?? "",
        isOptional: a.isOptional,
      })),
    })),
  }))

  async function handleUpdate(formData: any) {
    "use server"
    return updateWord({ ...formData, wordId })
  }

  const userPermissions = session.user.role === "MODERATOR"
    ? (await dbAuth.featurePermission.findMany({
        where: { userId: session.user.id },
        select: { featureKey: true },
      })).map(p => p.featureKey)
    : []

  // Read-only summary tab — mirrors the semantic_relations relationType/direction
  // convention used by the dedicated admin pages (relation-config.ts) so this
  // tab never falls out of sync with what /admin/synonyms, /admin/antonyms and
  // /admin/relations/[type] actually edit. synonym/antonym aren't part of
  // relation-config.ts (they have their own dedicated pages) — added directly.
  const ALL_RELATIONS: { key: string; relationType: string; direction?: "outgoing" | "incoming" }[] = [
    { key: "synonyms", relationType: "synonym" },
    { key: "antonyms", relationType: "antonym" },
    ...Object.entries(RELATION_CONFIG).map(([key, cfg]) => ({
      key,
      relationType: cfg.relationType,
      direction: cfg.direction,
    })),
  ]
  const meaningIds = (wordData.meanings || []).map((m) => m.id)
  const relationsByMeaning: Record<number, Record<string, any[]>> = {}
  for (const meaning of wordData.meanings || []) {
    relationsByMeaning[meaning.id] = {}
  }
  for (const { key, relationType, direction } of ALL_RELATIONS) {
    const relMap = direction === "outgoing"
      ? fetchOutgoingSemanticRelations(dbSimple, relationType, meaningIds)
      : direction === "incoming"
        ? fetchIncomingSemanticRelations(dbSimple, relationType, meaningIds)
        : fetchSymmetricSemanticRelations(dbSimple, relationType, meaningIds)
    for (const meaning of wordData.meanings || []) {
      const related = relMap.get(meaning.id) || []
      relationsByMeaning[meaning.id][key] = related.map((r) => ({
        id: r.relationId,
        targetMeaningId: r.otherMeaningId,
        targetMeaning: r.otherMeaning,
        targetWordId: r.otherWordId,
        targetWord: r.otherWord,
      }))
    }
  }

  const meaningRelations = (wordData.meanings || []).map(m => ({
    id: m.id,
    meaning: m.meaning ?? null,
    relations: relationsByMeaning[m.id] ?? {},
  }))

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-4 md:px-6 py-3 border-b shrink-0">
          <div className="flex gap-4">
            <a
              href={`/admin/words/${wordId}/edit?tab=article`}
              className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                activeTab === "article"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground/80"
              }`}
            >
              Статья
            </a>
            <a
              href={`/admin/words/${wordId}/edit?tab=relations`}
              className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                activeTab === "relations"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground/80"
              }`}
            >
              Отношения
            </a>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {activeTab === "article" ? (
            <div className="p-6 min-h-0 flex flex-1 flex-col overflow-scroll no-scrollbar">
              <ArticleForm
                title={`Редактирование статьи: ${wordData.value || "Без названия"}`}
                submitButtonText="Сохранить изменения"
                initialRoots={initialRoots}
                onSubmit={handleUpdate}
                initialData={{
                  wordId: wordData.id,
                  word: wordData.value || "",
                  stem: wordData.stem || "",
                  allophones,
                  homonymBases: initialHomonymBases,
                  hasAnomalies: wordData.hasAnomalies,
                  properNoun: wordData.properNoun,
                  isPublic: wordData.isPublic,
                  inflectionAnomalies: currentAnomalies,
                  attachedRoots,
                  meanings,
                  pos: wordData.pos,
                  gender: wordData.gender,
                  aspect: wordData.aspect,
                  transitivity: wordData.transitivity,
                  animacy: wordData.animacy,
                  degree: wordData.degree,
                  pronType: wordData.pronType,
                  numType: wordData.numType,
                  declension: wordData.declension,
                  conjugation: wordData.conjugation,
                  mainCategory: wordData.mainCategory,
                  usageType: wordData.usageType,
                  frequency: wordData.frequency,
                  intelligibility: wordData.intelligibility,
                  addition: wordData.addition,
                  sameInLanguages: wordData.sameInLanguages,
                  etymology: wordData.etymology,
                  proto: wordData.proto,
                  paradigm: wordData.paradigm,
                  protoStemClass: wordData.protoStemClass,
                  stemExtension: wordData.stemExtension,
                  stressPosition: wordData.stressPosition,
                  genesis: wordData.genesis,
                  secondaryStem: wordData.secondaryStem,
                  tertiaryStem: wordData.tertiaryStem,
                  external_id: wordData.external_id,
                }}
              />
            </div>
          ) : (
            <div className="p-6">
              <RelationsTab
                wordId={wordId}
                wordValue={wordData.value}
                meanings={meaningRelations}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}