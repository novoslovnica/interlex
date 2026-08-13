"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { prismaData } from "@/lib/prisma"
import { logAudit } from "@/lib/audit-log"

interface ActionResult {
  success: boolean
  error?: string
  candidateId?: number
}

/**
 * Материализует одну WordSuggestion в Candidate — ту же таблицу-стейджинг,
 * что уже умеет promoteCandidatesAction (app/admin/candidates/actions.ts)
 * превращать в Lexeme. Значение (meaningText/exampleSentence), которое
 * читатель предложил, у Candidate нет отдельного поля под смысл — как и у
 * автоматических кандидатов из корпуса — поэтому переносится в addition
 * как заметка; сам Meaning модератор добавляет вручную при финальном
 * редактировании слова после промоушена.
 */
export async function createCandidateFromSuggestionAction(suggestionId: number): Promise<ActionResult> {
  const session = await auth()
  if (!(await checkPermission(session, Feature.SuggestionsReview))) {
    return { success: false, error: "Forbidden" }
  }

  const suggestion = await prismaData.wordSuggestion.findUnique({ where: { id: suggestionId } })
  if (!suggestion) return { success: false, error: "Заявка не найдена" }
  if (suggestion.status !== "pending") return { success: false, error: "Уже обработано" }

  const additionParts = [`Предложено читателем. Значение: ${suggestion.meaningText}.`]
  if (suggestion.exampleSentence) additionParts.push(`Пример: ${suggestion.exampleSentence}.`)
  if (suggestion.sourceNote) additionParts.push(`Заметка: ${suggestion.sourceNote}.`)

  const candidate = await prismaData.candidate.create({
    data: {
      value: suggestion.suggestedValue,
      addition: additionParts.join(" "),
    },
  })

  await logAudit(session?.user, "Candidate", candidate.id, [
    { field: "createdFromWordSuggestionId", oldValue: null, newValue: suggestionId },
    { field: "value", oldValue: null, newValue: candidate.value },
  ])

  await prismaData.wordSuggestion.update({
    where: { id: suggestion.id },
    data: {
      status: "promoted",
      promotedCandidateId: candidate.id,
      reviewedByUserId: session?.user?.id ?? null,
      reviewedAt: new Date(),
    },
  })

  revalidatePath("/admin/suggestions")
  return { success: true, candidateId: candidate.id }
}

export async function rejectSuggestionAction(suggestionId: number, moderatorNote?: string): Promise<ActionResult> {
  const session = await auth()
  if (!(await checkPermission(session, Feature.SuggestionsReview))) {
    return { success: false, error: "Forbidden" }
  }

  await prismaData.wordSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: "rejected",
      moderatorNote: moderatorNote ?? null,
      reviewedByUserId: session?.user?.id ?? null,
      reviewedAt: new Date(),
    },
  })

  revalidatePath("/admin/suggestions")
  return { success: true }
}
