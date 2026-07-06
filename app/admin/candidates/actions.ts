"use server"

import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"

interface PromoteCandidateInput {
  candidateId: number
  value: string
  pos: string
  base?: string
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
    if (!session || !["ADMIN", "MODERATOR"].includes(session.user.role || "")) {
      return { success: false, error: "Forbidden" }
    }

    const results: { wordId: number; candidateId: number }[] = []

    for (const input of candidates) {
      const candidate = await db.candidate.findUnique({
        where: { id: input.candidateId },
      })
      if (!candidate) {
        throw new Error(`Candidate ${input.candidateId} not found`)
      }

      const slug = `${input.value}-${input.pos}`

      const word = await db.word.create({
        data: {
          slug,
          value: input.value,
          isv: candidate.isv,
          nsl: candidate.nsl,
          transcription: candidate.transcription,
          field: candidate.field,
          type: candidate.type,
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
          base: input.base || candidate.base,
          gender: input.gender || candidate.gender,
          declension: input.declension ?? candidate.declension,
          conjugation: input.conjugation ?? candidate.conjugation,
          accentSyllable: candidate.accentSyllable,
          alternationType: candidate.alternationType,
          fleetingVowelAt: candidate.fleetingVowelAt,
          hasAnomalies: candidate.hasAnomalies,
          actionHistory: candidate.actionHistory,
        },
      })

      if (input.rootId) {
        await db.rootWord.create({
          data: {
            wordId: word.id,
            rootId: input.rootId,
          },
        })
      }

      await db.candidate.update({
        where: { id: input.candidateId },
        data: {
          promotedAt: new Date(),
          promotedToWordId: word.id,
        },
      })

      results.push({ wordId: word.id, candidateId: input.candidateId })
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