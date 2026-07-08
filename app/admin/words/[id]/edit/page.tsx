import { prismaData as db } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { type Prisma } from "@/prisma/generated/data/client"
import ArticleForm from "@/components/ArticleForm"
import type { Metadata } from "next"
import { auth } from "@/auth"
import { buildEntry, append } from "@/lib/action-history"

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
  cu_word: true,
  nl_word: true,
  eo_word: true,
} as const

function getLangModel(lang: string) {
  const models: Record<string, unknown> = {
    en: db.en, ru: db.ru, mk: db.mk, sr: db.sr, bg: db.bg,
    pl: db.pl, cs: db.cs, sl: db.sl, de: db.de, uk: db.uk,
    be: db.be, sk: db.sk, hr: db.hr, cu: db.cu, nl: db.nl, eo: db.eo,
  }
  return models[lang]
}

function extractTranslations(meaning: {
  en_word: { id: number; value: string | null; veryfied: number | null }[]
  ru_word: { id: number; value: string | null; veryfied: number | null }[]
  mk_word: { id: number; value: string | null; veryfied: number | null }[]
  sr_word: { id: number; value: string | null; veryfied: number | null }[]
  bg_word: { id: number; value: string | null; veryfied: number | null }[]
  pl_word: { id: number; value: string | null; veryfied: number | null }[]
  cs_word: { id: number; value: string | null; veryfied: number | null }[]
  sl_word: { id: number; value: string | null; veryfied: number | null }[]
  de_word: { id: number; value: string | null; veryfied: number | null }[]
  uk_word: { id: number; value: string | null; veryfied: number | null }[]
  be_word: { id: number; value: string | null; veryfied: number | null }[]
  sk_word: { id: number; value: string | null; veryfied: number | null }[]
  hr_word: { id: number; value: string | null; veryfied: number | null }[]
  cu_word: { id: number; value: string | null; veryfied: number | null }[]
  nl_word: { id: number; value: string | null; veryfied: number | null }[]
  eo_word: { id: number; value: string | null; veryfied: number | null }[]
}): Record<string, { id: number; value: string; veryfied: number }[]> {
  const result: Record<string, { id: number; value: string; veryfied: number }[]> = {}
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
    { key: "cu", field: "cu_word" },
    { key: "nl", field: "nl_word" },
    { key: "eo", field: "eo_word" },
  ]
  for (const { key, field } of langKeys) {
    result[key] = (meaning[field] as { id: number; value: string | null; veryfied: number | null }[])
      .filter((t) => t.value?.trim())
      .map((t) => ({ id: t.id, value: t.value ?? "", veryfied: t.veryfied ?? 0 }))
  }
  return result
}

export default async function EditArticlePage({ params }: EditPageProps) {
  const { id } = await params
  const wordId = parseInt(id, 10)

  if (isNaN(wordId)) notFound()

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

  const meanings = (wordData.meanings || []).map((m) => ({
    id: m.id,
    meaning: m.meaning ?? "",
    examples: m.examples ?? "",
    translations: extractTranslations(m),
  }))

  async function ensureTranslation(
    lang: string,
    meaningId: number,
    translation: { id: number; value: string; veryfied: number },
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
      if (Object.keys(changes).length > 0) {
        await model.update({
          where: { id: translation.id },
          data: {
            value: translation.value || null,
            veryfied: translation.veryfied,
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
          actionHistory: append(null, buildEntry(author, {
            value: { old: null, new: translation.value },
            veryfied: { old: null, new: translation.veryfied },
          })),
        },
      })
    }
  }

  async function syncTranslations(
    lang: string,
    meaningId: number,
    translations: { id: number; value: string; veryfied: number }[],
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

    const grammarFields: string[] = [
      "pos", "gender", "aspect", "transitivity", "animacy", "degree",
      "pronType", "numType", "governsCase", "declension", "conjugation",
      "field", "type", "frequency", "intelligibility", "addition",
      "sameInLanguages", "etymology", "proto", "paradigm", "protoStemClass",
      "stemExtension", "genesis", "secondaryStem", "tertiaryStem",
      "accentSyllable", "alternationType", "fleetingVowelAt",
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
        ...grammarData,
        ...(Object.keys(wordChanges).length > 0
          ? { actionHistory: append(currentWordWithHistory?.actionHistory, buildEntry(author, wordChanges)) }
          : {}),
      },
    })

    const oldStem = currentWord?.stem?.trim() || null
    if (oldStem && oldStem !== stemValue) {
      const oldEntry = await db.baseHomonym.findUnique({ where: { base: oldStem } })
      if (oldEntry) {
        const ids: number[] = JSON.parse(oldEntry.wordIds).filter((id: number) => id !== wordId)
        if (ids.length > 0) {
          await db.baseHomonym.update({ where: { base: oldStem }, data: { wordIds: JSON.stringify(ids) } })
        } else {
          await db.baseHomonym.delete({ where: { base: oldStem } })
        }
      }
    }

    if (stemValue) {
      const existing = await db.baseHomonym.findUnique({ where: { base: stemValue } })
      if (existing) {
        const ids: number[] = JSON.parse(existing.wordIds)
        if (!ids.includes(wordId)) {
          ids.push(wordId)
          await db.baseHomonym.update({ where: { base: stemValue }, data: { wordIds: JSON.stringify(ids) } })
        }
      } else {
        await db.baseHomonym.create({ data: { base: stemValue, wordIds: JSON.stringify([wordId]) } })
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
          data: { meaning: m.meaning || null, examples: m.examples || null },
        })
      } else {
        const created = await db.meaning.create({
          data: {
            lexemeId: wordId,
            meaning: m.meaning || null,
            examples: m.examples || null,
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

  return (
    <div className="p-6 min-h-0 flex flex-1 flex-col overflow-scroll no-scrollbar">
      <ArticleForm
        title={`Редактирование статьи: ${wordData.value || "Без названия"}`}
        submitButtonText="Сохранить изменения"
        initialRoots={initialRoots}
        onSubmit={updateArticle}
        initialData={{
          word: wordData.value || "",
          stem: wordData.stem || "",
          hasAnomalies: wordData.hasAnomalies,
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
          field: wordData.field,
          type: wordData.type,
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
          accentSyllable: wordData.accentSyllable,
          alternationType: wordData.alternationType,
          fleetingVowelAt: wordData.fleetingVowelAt,
        }}
      />
    </div>
  )
}