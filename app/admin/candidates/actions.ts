"use server"

import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { logAudit } from "@/lib/audit-log"
import { resetExistingLexemeIndex } from "@/lib/corpus/candidates/existingLexemes"

interface PromoteCandidateInput {
  candidateId: number
  value: string
  pos: string
  stem?: string
  gender?: string
  declension?: number | null
  conjugation?: number | null
  rootId?: number | null
  /**
   * Модератор подтвердил, что это отдельное слово (омоним), хотя в словаре уже
   * есть лексема с тем же slug или теми же value и частью речи. Тогда slug
   * получает числовой суффикс вместо падения на unique-ограничении.
   */
  allowDuplicate?: boolean
}

export interface PromoteConflict {
  candidateId: number
  value: string
  pos: string
  existing: { id: number; slug: string; value: string | null; pos: string | null }[]
}

export interface PromoteResult {
  success: boolean
  error?: string
  results?: { lexemeId: number; candidateId: number }[]
  /** Кандидаты, совпавшие с существующими лексемами. Ничего не создано — нужно подтверждение. */
  conflicts?: PromoteConflict[]
}

function baseSlug(input: PromoteCandidateInput): string {
  return `${input.value}-${input.pos}`
}

// Первый свободный slug: сам base, затем base-2, base-3... Омонимы с одинаковыми
// value и частью речи для словаря нормальны, а Lexeme.slug уникален.
async function uniqueSlug(base: string): Promise<string> {
  const rows = await db.lexeme.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })
  const taken = new Set(rows.map((r) => r.slug))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export async function promoteCandidatesAction(
  candidates: PromoteCandidateInput[]
): Promise<PromoteResult> {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.CandidatesPromote)) {
      return { success: false, error: "Forbidden" }
    }

    // Совпадения со словарём проверяются для всех кандидатов ДО создания первой
    // лексемы: цикл ниже не транзакционный, и падение на середине оставляло
    // часть кандидатов перенесённой, а часть нет.
    const conflicts: PromoteConflict[] = []
    for (const input of candidates) {
      if (input.allowDuplicate) continue
      const existing = await db.lexeme.findMany({
        where: { OR: [{ slug: baseSlug(input) }, { value: input.value, pos: input.pos }] },
        select: { id: true, slug: true, value: true, pos: true },
        take: 10,
      })
      if (existing.length > 0) {
        conflicts.push({ candidateId: input.candidateId, value: input.value, pos: input.pos, existing })
      }
    }
    if (conflicts.length > 0) return { success: false, conflicts }

    const results: { lexemeId: number; candidateId: number }[] = []

    for (const input of candidates) {
      const candidate = await db.candidate.findUnique({
        where: { id: input.candidateId },
      })
      if (!candidate) {
        throw new Error(`Candidate ${input.candidateId} not found`)
      }

      const slug = await uniqueSlug(baseSlug(input))

      const word = await db.lexeme.create({
        data: {
          slug,
          value: input.value,
          transcription: candidate.transcription,
          mainCategory: candidate.mainCategory,
          usageType: candidate.usageType,
          pos: input.pos,
          aspect: candidate.aspect,
          transitivity: candidate.transitivity,
          animacy: candidate.animacy,
          degree: candidate.degree,
          pronType: candidate.pronType,
          numType: candidate.numType,
          frequency: candidate.frequency,
          intelligibility: candidate.intelligibility,
          addition: candidate.addition,
          sameInLanguages: candidate.sameInLanguages,
          etymology: candidate.etymology,
          proto: candidate.proto,
          paradigm: candidate.paradigm,
          protoStemClass: candidate.protoStemClass,
          stemExtension: candidate.stemExtension,
          genesis: candidate.genesis,
          stem: input.stem || candidate.stem,
          gender: input.gender || candidate.gender,
          declension: input.declension ?? candidate.declension,
          conjugation: input.conjugation ?? candidate.conjugation,
          hasAnomalies: candidate.hasAnomalies,
        },
      })
      await logAudit(session?.user, "Lexeme", word.id, [
        { field: "promotedFromCandidateId", oldValue: null, newValue: input.candidateId },
      ])

      const coreFlavor = await db.allophoneFlavor.findUnique({ where: { code: 'CORE' } })
      const nslFlavor = await db.allophoneFlavor.findUnique({ where: { code: 'NSL' } })

      if (coreFlavor && candidate.isv) {
        await db.lexemeAllophone.create({
          data: { lexemeId: word.id, flavorId: coreFlavor.id, value: candidate.isv, type: 'standard' },
        })
      }
      if (nslFlavor && candidate.nsl) {
        await db.lexemeAllophone.create({
          data: { lexemeId: word.id, flavorId: nslFlavor.id, value: candidate.nsl, type: 'standard' },
        })
      }

      if (input.rootId) {
        await db.lexemeMorpheme.create({
          data: {
            lexemeId: word.id,
            morphemeId: input.rootId,
          },
        })
      }

      await db.candidate.update({
        where: { id: input.candidateId },
        data: {
          promotedAt: new Date(),
          promotedToLexemeId: word.id,
        },
      })

      results.push({ lexemeId: word.id, candidateId: input.candidateId })
    }

    resetExistingLexemeIndex()
    return { success: true, results }
  } catch (error) {
    console.error("Promote Candidates Error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
