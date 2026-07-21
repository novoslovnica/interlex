"use server"

import { prismaData as db, prismaAuth as dbAuth } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { generateStemCandidates } from "@/lib/grammar/common/stem-candidates"
import { generateUniqueSlug } from "@/lib/slug"
import { buildEntry, append } from "@/lib/action-history"

const meaningLanguageInclude = {
  en_word: true, ru_word: true, mk_word: true, sr_word: true,
  bg_word: true, pl_word: true, cs_word: true, sl_word: true,
  de_word: true, uk_word: true, be_word: true, sk_word: true,
  hr_word: true, hsb_word: true, dsb_word: true, cu_word: true,
  nl_word: true, eo_word: true,
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

async function ensureTranslation(
  lang: string, meaningId: number,
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
  lang: string, meaningId: number,
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

export async function updateWord(formData: any) {
  const session = await auth()
  const author = session?.user?.email || "unknown"

  const wordId = parseInt(formData.wordId, 10)
  if (isNaN(wordId)) throw new Error("Invalid wordId")

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
    "stemExtension", "stressPosition", "genesis", "secondaryStem", "tertiaryStem",
    "external_id",
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

  const newPos = grammarData.pos as string | null | undefined
  let newSlug: string | undefined
  if (currentWord?.value !== formData.word || currentWord?.pos !== newPos) {
    newSlug = await generateUniqueSlug(formData.word, newPos ?? "", wordId)
  }

  await db.lexeme.update({
    where: { id: wordId },
    data: {
      value: formData.word,
      stem: stemValue,
      hasAnomalies: formData.hasAnomalies === true,
      properNoun: formData.properNoun === true,
      ...grammarData,
      ...(newSlug ? { slug: newSlug } : {}),
      ...(Object.keys(wordChanges).length > 0
        ? { actionHistory: append(currentWordWithHistory?.actionHistory, buildEntry(author, wordChanges)) }
        : {}),
    },
  })

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
  const formHomonymBases: Array<{ base: string; flavor: string }> = formData.homonymBases || []
  const newBaseSet = new Set(formHomonymBases.map((b: { base: string }) => b.base))
  const oldBaseSet = new Set(oldCandidates)

  for (const base of oldCandidates) {
    if (!newBaseSet.has(base)) {
      const entry = await db.baseHomonym.findUnique({ where: { base } })
      if (entry) {
        const parsed = JSON.parse(entry.wordIds)
        let items: Array<{ id: number; flavor?: string }>
        if (typeof parsed[0] === "number") {
          items = (parsed as number[]).filter((id: number) => id !== wordId).map((id: number) => ({ id, flavor: "CORE" }))
        } else {
          items = (parsed as Array<{ id: number; flavor?: string }>).filter((item) => item.id !== wordId)
        }
        if (items.length > 0) {
          await db.baseHomonym.update({ where: { base }, data: { wordIds: JSON.stringify(items) } })
        } else {
          await db.baseHomonym.delete({ where: { base } })
        }
      }
    }
  }

  for (const { base, flavor } of formHomonymBases) {
    if (!oldBaseSet.has(base)) {
      const entry = await db.baseHomonym.findUnique({ where: { base } })
      if (entry) {
        const parsed = JSON.parse(entry.wordIds)
        let items: Array<{ id: number; flavor?: string }>
        if (typeof parsed[0] === "number") {
          items = (parsed as number[]).map((id: number) => ({ id, flavor: id === wordId ? flavor : "CORE" }))
        } else {
          items = parsed as Array<{ id: number; flavor?: string }>
          const existingIdx = items.findIndex((item) => item.id === wordId)
          if (existingIdx >= 0) {
            items[existingIdx].flavor = flavor
          } else {
            items.push({ id: wordId, flavor })
          }
        }
        await db.baseHomonym.update({ where: { base }, data: { wordIds: JSON.stringify(items) } })
      } else {
        await db.baseHomonym.create({ data: { base, wordIds: JSON.stringify([{ id: wordId, flavor }]) } })
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
        data: {
          meaning: m.meaning || null,
          examples: m.examples || null,
          meaningVeryfied: m.meaningVeryfied ?? null,
          meaningMessage: m.meaningMessage || null,
          examplesVeryfied: m.examplesVeryfied ?? null,
          examplesMessage: m.examplesMessage || null,
        },
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

  redirect("/admin")
}

export async function createWord(formData: any) {
  const session = await auth()
  const author = session?.user?.email || "unknown"
  const stemValue = formData.stem?.trim() || null
  const posValue = formData.pos?.trim() || "unknown"
  const slug = await generateUniqueSlug(formData.word?.toLowerCase() || "", posValue)

  const newWord = await db.lexeme.create({
    data: {
      value: formData.word,
      slug,
      stem: stemValue,
      hasAnomalies: formData.hasAnomalies === true,
      external_id: formData.external_id ?? null,
      actionHistory: append(null, buildEntry(author, {
        value: { old: null, new: formData.word },
        stem: { old: null, new: stemValue },
        hasAnomalies: { old: null, new: formData.hasAnomalies === true },
        external_id: { old: null, new: formData.external_id ?? null },
      })),
    },
  })

  const allophoneData = formData.allophones || {}
  for (const code of ["CORE", "NSL", "EAST", "WEST", "SOUTH"] as const) {
    const strValue = (allophoneData[code.toLowerCase()] as string)?.trim()
    if (!strValue) continue
    const flavor = await db.allophoneFlavor.findUnique({ where: { code } })
    if (!flavor) continue
    await db.lexemeAllophone.create({
      data: { lexemeId: newWord.id, flavorId: flavor.id, type: "standard", value: strValue },
    })
  }

  const formHomonymBases: Array<{ base: string; flavor: string }> = formData.homonymBases || []
  for (const { base, flavor } of formHomonymBases) {
    if (!base.trim()) continue
    const existing = await db.baseHomonym.findUnique({ where: { base } })
    if (existing) {
      const parsed = JSON.parse(existing.wordIds)
      let items: Array<{ id: number; flavor?: string }>
      if (typeof parsed[0] === "number") {
        items = (parsed as number[]).map((id: number) => ({ id, flavor: id === newWord.id ? flavor : "CORE" }))
      } else {
        items = parsed as Array<{ id: number; flavor?: string }>
        const existingIdx = items.findIndex((item) => item.id === newWord.id)
        if (existingIdx >= 0) {
          items[existingIdx].flavor = flavor
        } else {
          items.push({ id: newWord.id, flavor })
        }
      }
      await db.baseHomonym.update({ where: { base }, data: { wordIds: JSON.stringify(items) } })
    } else {
      await db.baseHomonym.create({
        data: { base, wordIds: JSON.stringify([{ id: newWord.id, flavor }]) },
      })
    }
  }

  const anomalies = formData.inflectionAnomalies || []
  if (anomalies.length > 0) {
    await db.inflectionAnomaly.createMany({
      data: anomalies.map((a: { inflection: string; grammeme: string }) => ({
        lexemeId: newWord.id,
        inflection: a.inflection,
        grammeme: a.grammeme,
      })),
    })
  }

  const newMeaning = await db.meaning.create({
    data: { lexemeId: newWord.id, meaning: "Основное значение" },
  })

  await db.en.create({
    data: {
      meaningId: newMeaning.id,
      value: formData.translationEn,
      veryfied: formData.isEnVerified ? 1 : 0,
      actionHistory: append(null, buildEntry(author, {
        value: { old: null, new: formData.translationEn },
        veryfied: { old: null, new: formData.isEnVerified ? 1 : 0 },
      })),
    },
  })

  await db.ru.create({
    data: {
      meaningId: newMeaning.id,
      value: formData.translationRu,
      veryfied: formData.isRuVerified ? 1 : 0,
      actionHistory: append(null, buildEntry(author, {
        value: { old: null, new: formData.translationRu },
        veryfied: { old: null, new: formData.isRuVerified ? 1 : 0 },
      })),
    },
  })

  const createdRootIds: number[] = []
  if (formData.newRootValues && formData.newRootValues.length > 0) {
    for (const val of formData.newRootValues) {
      const newRoot = await db.morpheme.create({
        data: { value: val, type: 0, actionHistory: append(null, buildEntry(author, {
          value: { old: null, new: val },
          type: { old: null, new: 0 },
        })) },
      })
      createdRootIds.push(newRoot.id)
    }
  }

  const finalRootIds = [...(formData.rootIds || []), ...createdRootIds]
  if (finalRootIds.length > 0) {
    await db.lexemeMorpheme.createMany({
      data: finalRootIds.map((rId: number) => ({ lexemeId: newWord.id, morphemeId: rId })),
    })
  }

  redirect("/admin")
}