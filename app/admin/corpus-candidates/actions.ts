"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { prismaCorpus, prismaData } from "@/lib/prisma"
import { logAudit } from "@/lib/audit-log"

interface ActionResult {
  success: boolean
  error?: string
  candidateId?: number
}

/**
 * Материализует одну гипотезу CorpusCandidateProposal в data.db Candidate —
 * ту же таблицу-стейджинг, что и ручной ввод, promoteCandidatesAction
 * (app/admin/candidates/actions.ts) уже умеет превращать её в Lexeme.
 * Сознательно НЕ создаёт Lexeme напрямую — сохраняем существующую
 * редакторскую проверку через /admin/candidates.
 *
 * Остальные гипотезы того же clusterKey переводятся в
 * 'merged_into_existing' — судьба кластера решена, они не должны больше
 * маячить в очереди "pending".
 */
export async function approveHypothesisAction(hypothesisId: number): Promise<ActionResult> {
  const session = await auth()
  if (!(await checkPermission(session, Feature.CorpusCandidatesReview))) {
    return { success: false, error: "Forbidden" }
  }

  const hypothesis = await prismaCorpus.corpusCandidateProposal.findUnique({ where: { id: hypothesisId } })
  if (!hypothesis) return { success: false, error: "Гипотеза не найдена" }
  if (hypothesis.status !== "pending") return { success: false, error: "Уже обработано" }

  const candidate = await prismaData.candidate.create({
    data: {
      value: hypothesis.reconstructedForm,
      pos: hypothesis.guessedPos,
      stem: hypothesis.guessedStem,
    },
  })

  await logAudit(session?.user, "Candidate", candidate.id, [
    { field: "createdFromCorpusCluster", oldValue: null, newValue: hypothesis.clusterKey },
    { field: "value", oldValue: null, newValue: candidate.value },
    { field: "pos", oldValue: null, newValue: candidate.pos },
  ])

  const now = new Date()
  const reviewedByEmail = session?.user?.email ?? null

  await prismaCorpus.corpusCandidateProposal.update({
    where: { id: hypothesis.id },
    data: { status: "promoted", candidateId: candidate.id, reviewedByEmail, reviewedAt: now },
  })
  await prismaCorpus.corpusCandidateProposal.updateMany({
    where: { clusterKey: hypothesis.clusterKey, id: { not: hypothesis.id }, status: "pending" },
    data: { status: "merged_into_existing", reviewedByEmail, reviewedAt: now },
  })

  revalidatePath("/admin/corpus-candidates")
  return { success: true, candidateId: candidate.id }
}

/**
 * Отклоняет весь кластер (не одну гипотезу) — слово не подходит для
 * словаря вообще (опечатка/имя собственное/иностранное слово/...) или уже
 * есть по другой причине. Помеченные rejected никогда больше не
 * появляются в очереди "pending", сколько раз ни перезапускай генерацию
 * (см. generateCorpusCandidateProposals — upsert не трогает status).
 */
export async function rejectClusterAction(
  clusterKey: string,
  resolutionNote?: string,
): Promise<ActionResult> {
  const session = await auth()
  if (!(await checkPermission(session, Feature.CorpusCandidatesReview))) {
    return { success: false, error: "Forbidden" }
  }

  await prismaCorpus.corpusCandidateProposal.updateMany({
    where: { clusterKey, status: "pending" },
    data: {
      status: "rejected",
      resolutionNote: resolutionNote ?? null,
      reviewedByEmail: session?.user?.email ?? null,
      reviewedAt: new Date(),
    },
  })

  revalidatePath("/admin/corpus-candidates")
  return { success: true }
}
