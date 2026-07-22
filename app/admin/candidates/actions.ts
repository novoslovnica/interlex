"use server"

import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { logAudit } from "@/lib/audit-log"

interface PromoteCandidateInput {
  candidateId: number
  value: string
  pos: string
  stem?: string
  gender?: string
  declension?: number | null
  conjugation?: number | null
  rootId?: number | null
}

export async function promoteCandidatesAction(
  candidates: PromoteCandidateInput[]
) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.CandidatesPromote)) {
      return { success: false, error: "Forbidden" }
    }

    const results: { lexemeId: number; candidateId: number }[] = []

    for (const input of candidates) {
      const candidate = await db.candidate.findUnique({
        where: { id: input.candidateId },
      })
      if (!candidate) {
        throw new Error(`Candidate ${input.candidateId} not found`)
      }

      const slug = `${input.value}-${input.pos}`

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

    return { success: true, results }
  } catch (error) {
    console.error("Promote Candidates Error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}