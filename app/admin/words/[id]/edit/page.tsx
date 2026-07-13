import { prismaAuth as dbAuth, prismaData as db } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { type Prisma } from "@/prisma/generated/data/client"
import ArticleForm from "@/components/ArticleForm"
import type { Metadata } from "next"
import { auth } from "@/auth"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { buildEntry, append } from "@/lib/action-history"
import { generateStemCandidates } from "@/lib/grammar/common/stem-candidates"
import { init } from "@/lib/sqlite"
import AdminNav from "@/components/AdminNav"
import { RelationsTab } from "./_components/relations-tab"

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

const meaningLanguageInclude = {
  en_word: true,
  ru_word: true,
  mk_word: true,
  sr_word: true,
  bg_word: true,
  pl_word: true,
  cs_word: true,
  sl_word: true,
  de_word: true,
  uk_word: true,
  be_word: true,
  sk_word: true,
  hr_word: true,
  hsb_word: true,
  dsb_word: true,
  cu_word: true,
  nl_word: true,
  eo_word: true,
} as const

function getLangModel(lang: string) {
  const models: Record<string, unknown> = {
    en: db.en, ru: db.ru, mk: db.mk, sr: db.sr, bg: db.bg,
    pl: db.pl, cs: db.cs, sl: db.sl, de: db.de, uk: db.uk,
    be: db.be, sk: db.sk, hr: db.hr, hsb: db.hsb, dsb: db.dsb,
    cu: db.cu, nl: db.nl, eo: db.eo,
  }
  return models[lang]
}

function extractTranslations(meaning: {
  en_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  ru_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  mk_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  sr_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  bg_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  pl_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  cs_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  sl_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  de_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  uk_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  be_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  sk_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  hr_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  hsb_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  dsb_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  cu_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  nl_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
  eo_word: { id: number; value: string | null; veryfied: number | null; message: string | null }[]
}): Record<string, { id: number; value: string; veryfied: number; message: string }[]> {
  const result: Record<string, { id: number; value: string; veryfied: number; message: string }[]> = {}
  const langKeys: { key: string; field: keyof typeof meaning }[] = [
    { key: "en", field: "en_word" },
    { key: "ru", field: "ru_word" },
    { key: "mk", field: "mk_word" },
    { key: "sr", field: "sr_word" },
    { key: "bg", field: "bg_word" },
    { key: "pl", field: "pl_word" },
    { key: "cs", field: "cs_word" },
    { key: "sl", field: "sl_word" },
    { key: "de", field: "de_word" },
    { key: "uk", field: "uk_word" },
    { key: "be", field: "be_word" },
    { key: "sk", field: "sk_word" },
    { key: "hr", field: "hr_word" },
    { key: "hsb", field: "hsb_word" },
    { key: "dsb", field: "dsb_word" },
    { key: "cu", field: "cu_word" },
    { key: "nl", field: "nl_word" },
    { key: "eo", field: "eo_word" },
  ]
  for (const { key, field } of langKeys) {
    result[key] = (meaning[field] as { id: number; value: string | null; veryfied: number | null; message: string | null }[])
      .filter((t) => t.value?.trim())
      .map((t) => ({ id: t.id, value: t.value ?? "", veryfied: t.veryfied ?? 0, message: t.message ?? "" }))
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
          include: meaningLanguageInclude,
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

  const initialHomonymBases = baseHomonyms.map((h) => h.base)

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
    meaningVeryfied: m.meaningVeryfied ?? 0,
    meaningMessage: m.meaningMessage ?? "",
    examplesVeryfied: m.examplesVeryfied ?? 0,
    examplesMessage: m.examplesMessage ?? "",
    translations: extractTranslations(m as any),
  }))

  async function ensureTranslation(
    lang: string,
    meaningId: number,
    translation: { id: number; value: string; veryfied: number; message: string },
    author: string
  ) {
    const model = getLangModel(lang) as any
    if (!model) return
    if (translation.id > 0) {
      const existing = await model.findUnique({ where: { id: translation.id } })
      if (!existing) return
      const changes: Record<string, { old: unknown; new: unknown }> = {}
      if ((existing.value ?? "") !== translation.value) {
        changes.value = { old: existing.value ?? null, new: translation.value }
      }
      if ((existing.veryfied ?? 0) !== translation.veryfied) {
        changes.veryfied = { old: existing.veryfied ?? 0, new: translation.veryfied }
      }
      if ((existing.message ?? "") !== translation.message) {
        changes.message = { old: existing.message ?? null, new: translation.message }
      }
      if (Object.keys(changes).length > 0) {
        await model.update({
          where: { id: translation.id },
          data: {
            value: translation.value || null,
            veryfied: translation.veryfied,
            message: translation.message || null,
            actionHistory: append(existing.actionHistory, buildEntry(author, changes)),
          },
        })
      }
    } else if (translation.value.trim()) {
      await model.create({
        data: {
          meaningId,
          value: translation.value,
          veryfied: translation.veryfied,
          message: translation.message || null,
          actionHistory: append(null, buildEntry(author, {
            value: { old: null, new: translation.value },
            veryfied: { old: null, new: translation.veryfied },
            ...(translation.message ? { message: { old: null, new: translation.message } } : {}),
          })),
        },
      })
    }
  }

  async function syncTranslations(
    lang: string,
    meaningId: number,
    translations: { id: number; value: string; veryfied: number; message: string }[],
    author: string
  ) {
    const model = getLangModel(lang) as any
    if (!model) return
    const existingRows = await model.findMany({
      where: { meaningId },
      select: { id: true },
    })
    const existingIds = new Set<number>(existingRows.map((r: { id: number }) => r.id))
    const formIds = new Set(translations.filter((t) => t.id > 0).map((t) => t.id))

    const toDelete: number[] = [...existingIds].filter((id) => !formIds.has(id))
    if (toDelete.length > 0) {
      await model.deleteMany({ where: { id: { in: toDelete } } })
    }

    for (const t of translations) {
      await ensureTranslation(lang, meaningId, t, author)
    }
  }

  async function updateArticle(formData: any) {
    "use server"
    const session = await auth()
    const author = session?.user?.email || "unknown"

    const stemValue = formData.stem?.trim() || null

    const currentWord = await db.lexeme.findUnique({ where: { id: wordId } })
    const currentWordWithHistory = currentWord as { actionHistory?: string | null } & typeof currentWord

    const wordChanges: Record<string, { old: unknown; new: unknown }> = {}
    if (currentWord?.value !== formData.word) {
      wordChanges.value = { old: currentWord?.value ?? null, new: formData.word }
    }
    if ((currentWord?.stem ?? null) !== stemValue) {
      wordChanges.stem = { old: currentWord?.stem ?? null, new: stemValue }
    }
    if (currentWord?.hasAnomalies !== (formData.hasAnomalies === true)) {
      wordChanges.hasAnomalies = { old: currentWord?.hasAnomalies, new: formData.hasAnomalies === true }
    }
    if (currentWord?.properNoun !== (formData.properNoun === true)) {
      wordChanges.properNoun = { old: currentWord?.properNoun, new: formData.properNoun === true }
    }

    const grammarFields: string[] = [
      "pos", "gender", "aspect", "transitivity", "animacy", "degree",
      "pronType", "numType", "governsCase", "declension", "conjugation",
      "mainCategory", "usageType", "intelligibility", "addition",
      "sameInLanguages", "etymology", "proto", "paradigm", "protoStemClass",
      "stemExtension", "genesis", "secondaryStem", "tertiaryStem",
    ]

    const grammarData: Record<string, unknown> = {}
    for (const f of grammarFields) {
      const oldVal = (currentWord as Record<string, unknown>)[f] ?? null
      const newVal = formData[f] !== undefined && formData[f] !== "" ? formData[f] : null
      if (oldVal !== newVal) {
        wordChanges[f] = { old: oldVal, new: newVal }
      }
      grammarData[f] = newVal
    }

    await db.lexeme.update({
      where: { id: wordId },
      data: {
        value: formData.word,
        stem: stemValue,
        hasAnomalies: formData.hasAnomalies === true,
        properNoun: formData.properNoun === true,
        ...grammarData,
        ...(Object.keys(wordChanges).length > 0
          ? { actionHistory: append(currentWordWithHistory?.actionHistory, buildEntry(author, wordChanges)) }
          : {}),
      },
    })

    // Upsert allophones
    const allophoneData = formData.allophones || {}
    for (const code of ["CORE", "NSL", "EAST", "WEST", "SOUTH"] as const) {
      const rawValue = allophoneData[code.toLowerCase()]
      const strValue = (rawValue as string)?.trim() || ""
      const flavor = await db.allophoneFlavor.findUnique({ where: { code } })
      if (!flavor) continue
      const existing = await db.lexemeAllophone.findFirst({
        where: { lexemeId: wordId, flavorId: flavor.id, type: "standard" },
      })
      if (existing) {
        if (strValue) {
          await db.lexemeAllophone.update({
            where: { id: existing.id },
            data: { value: strValue },
          })
        } else {
          await db.lexemeAllophone.delete({ where: { id: existing.id } })
        }
      } else if (strValue) {
        await db.lexemeAllophone.create({
          data: { lexemeId: wordId, flavorId: flavor.id, type: "standard", value: strValue },
        })
      }
    }

    const oldStem = currentWord?.stem?.trim() || null
    const oldCandidates = oldStem
      ? generateStemCandidates({
          stem: oldStem,
          secondaryStem: currentWord?.secondaryStem || null,
          tertiaryStem: currentWord?.tertiaryStem || null,
          isv: currentWord?.value,
          pos: currentWord?.pos,
        })
      : []
    const formHomonymBases: string[] = formData.homonymBases || []
    const oldBases = new Set(oldCandidates)
    const newBases = new Set(formHomonymBases)

    for (const base of oldCandidates) {
      if (!newBases.has(base)) {
        const entry = await db.baseHomonym.findUnique({ where: { base } })
        if (entry) {
          const ids: number[] = JSON.parse(entry.wordIds).filter((id: number) => id !== wordId)
          if (ids.length > 0) {
            await db.baseHomonym.update({ where: { base }, data: { wordIds: JSON.stringify(ids) } })
          } else {
            await db.baseHomonym.delete({ where: { base } })
          }
        }
      }
    }

    for (const base of formHomonymBases) {
      if (!oldBases.has(base)) {
        const entry = await db.baseHomonym.findUnique({ where: { base } })
        if (entry) {
          const ids: number[] = JSON.parse(entry.wordIds)
          if (!ids.includes(wordId)) {
            ids.push(wordId)
            await db.baseHomonym.update({ where: { base }, data: { wordIds: JSON.stringify(ids) } })
          }
        } else {
          await db.baseHomonym.create({ data: { base, wordIds: JSON.stringify([wordId]) } })
        }
      }
    }

    await db.inflectionAnomaly.deleteMany({ where: { lexemeId: wordId } })
    const anomalies = formData.inflectionAnomalies || []
    if (anomalies.length > 0) {
      await db.inflectionAnomaly.createMany({
        data: anomalies.map((a: { inflection: string; grammeme: string }) => ({
          lexemeId: wordId,
          inflection: a.inflection,
          grammeme: a.grammeme,
        })),
      })
    }

    const createdRootIds: number[] = []
    if (formData.newRootValues && formData.newRootValues.length > 0) {
      for (const val of formData.newRootValues) {
        const newRoot = await db.morpheme.create({
          data: {
            value: val,
            type: 0,
            actionHistory: append(null, buildEntry(author, {
              value: { old: null, new: val },
              type: { old: null, new: 0 },
            })),
          },
        })
        createdRootIds.push(newRoot.id)
      }
    }

    const finalRootIds = [...(formData.rootIds || []), ...createdRootIds]
    await db.lexemeMorpheme.deleteMany({ where: { lexemeId: wordId } })
    if (finalRootIds.length > 0) {
      await db.lexemeMorpheme.createMany({
        data: finalRootIds.map((rId: number) => ({
          lexemeId: wordId,
          morphemeId: rId,
        })),
      })
    }

    const existingMeanings = await db.meaning.findMany({
      where: { lexemeId: wordId },
      select: { id: true },
    })
    const existingMeaningIds = new Set(existingMeanings.map((m) => m.id))
    const formMeaningIds = new Set(
      (formData.meanings || []).filter((m: any) => m.id > 0).map((m: any) => m.id)
    )

    const meaningsToDelete = [...existingMeaningIds].filter((id) => !formMeaningIds.has(id))
    if (meaningsToDelete.length > 0) {
      await db.meaning.deleteMany({ where: { id: { in: meaningsToDelete } } })
    }

    for (const m of formData.meanings || []) {
      let meaningId = m.id

      if (m.id > 0) {
        await db.meaning.update({
          where: { id: m.id },
          data: { meaning: m.meaning || null, examples: m.examples || null, meaningVeryfied: m.meaningVeryfied ?? null, meaningMessage: m.meaningMessage || null, examplesVeryfied: m.examplesVeryfied ?? null, examplesMessage: m.examplesMessage || null },
        })
      } else {
        const created = await db.meaning.create({
          data: {
            lexemeId: wordId,
            meaning: m.meaning || null,
            examples: m.examples || null,
            meaningVeryfied: m.meaningVeryfied ?? null,
            meaningMessage: m.meaningMessage || null,
            examplesVeryfied: m.examplesVeryfied ?? null,
            examplesMessage: m.examplesMessage || null,
          },
        })
        meaningId = created.id
      }

      if (m.translations) {
        for (const lang of Object.keys(m.translations)) {
          await syncTranslations(lang as string, meaningId, m.translations[lang], author)
        }
      }
    }

    redirect("/admin/dictionary")
  }

  const userPermissions = session.user.role === "MODERATOR"
    ? (await dbAuth.featurePermission.findMany({
        where: { userId: session.user.id },
        select: { featureKey: true },
      })).map(p => p.featureKey)
    : []

  const dbSimple = await init()
  const ALL_TABLES: { key: string; table: string }[] = [
    { key: "synonyms", table: "synonyms" },
    { key: "antonyms", table: "antonyms" },
    { key: "hypernyms", table: "hypernyms" },
    { key: "hyponyms", table: "hyponyms" },
    { key: "meronyms", table: "meronyms" },
    { key: "holonyms", table: "holonyms" },
    { key: "related-words", table: "related_words" },
    { key: "causes", table: "causes" },
    { key: "effects", table: "effects" },
    { key: "premises", table: "premises" },
    { key: "conclusions", table: "conclusions" },
  ]
  const relationsByMeaning: Record<number, Record<string, any[]>> = {}
  for (const meaning of wordData.meanings || []) {
    relationsByMeaning[meaning.id] = {}
    for (const t of ALL_TABLES) {
      relationsByMeaning[meaning.id][t.key] = []
    }
  }
  for (const { key, table } of ALL_TABLES) {
    const rows = dbSimple.prepare(`
      SELECT m.id AS meaningId, r.id AS relationId, r.targetId AS targetMeaningId, r.proximity,
             t.meaning AS targetMeaning, tl.value AS targetWord, tl.id AS targetWordId
      FROM meanings m
      LEFT JOIN ${table} r ON r.sourceId = m.id
      LEFT JOIN meanings t ON t.id = r.targetId
      LEFT JOIN lexemes tl ON tl.id = t.lexemeId
      WHERE m.lexemeId = ?
    `).all(wordId) as any[]
    for (const row of rows) {
      if (row.relationId && relationsByMeaning[row.meaningId]) {
        relationsByMeaning[row.meaningId][key].push({
          id: row.relationId,
          targetMeaningId: row.targetMeaningId,
          targetMeaning: row.targetMeaning,
          targetWordId: row.targetWordId,
          targetWord: row.targetWord,
        })
      }
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
                onSubmit={updateArticle}
                initialData={{
                  word: wordData.value || "",
                  stem: wordData.stem || "",
                  allophones,
                  homonymBases: initialHomonymBases,
                  hasAnomalies: wordData.hasAnomalies,
                  properNoun: wordData.properNoun,
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
                  governsCase: wordData.governsCase,
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
                  genesis: wordData.genesis,
                  secondaryStem: wordData.secondaryStem,
                  tertiaryStem: wordData.tertiaryStem,
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