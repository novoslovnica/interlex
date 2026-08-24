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
export interface ApproveOverrides {
  /**
   * Правленая словарная форма. Нужна прежде всего из-за диакритики: в корпусе
   * слово сплошь и рядом написано упрощённо ("jezyk"), а в словарь оно должно
   * попасть в каноническом написании ("język") — вывести его алгоритмически
   * нельзя, "e" может быть и e, и ě, и ę. Реконструкция даёт заготовку,
   * последнее слово за модератором.
   */
  value?: string
  /** Правленая часть речи: гипотезы для одного слова часто расходятся именно в ней. */
  pos?: string
}

export async function approveHypothesisAction(
  hypothesisId: number,
  overrides?: ApproveOverrides,
): Promise<ActionResult> {
  const session = await auth()
  if (!(await checkPermission(session, Feature.CorpusCandidatesReview))) {
    return { success: false, error: "Forbidden" }
  }

  const hypothesis = await prismaCorpus.corpusCandidateProposal.findUnique({ where: { id: hypothesisId } })
  if (!hypothesis) return { success: false, error: "Гипотеза не найдена" }
  if (hypothesis.status !== "pending") return { success: false, error: "Уже обработано" }

  const value = overrides?.value?.trim() || hypothesis.reconstructedForm
  const pos = overrides?.pos?.trim() || hypothesis.guessedPos
  if (!value) return { success: false, error: "Пустая словарная форма" }

  const candidate = await prismaData.candidate.create({
    data: {
      value,
      pos,
      stem: hypothesis.guessedStem,
    },
  })

  await logAudit(session?.user, "Candidate", candidate.id, [
    { field: "createdFromCorpusCluster", oldValue: null, newValue: hypothesis.clusterKey },
    // Правку модератора фиксируем как переход "предложено -> принято", чтобы
    // потом было видно, насколько реконструкция попадает в цель.
    { field: "value", oldValue: hypothesis.reconstructedForm, newValue: candidate.value },
    { field: "pos", oldValue: hypothesis.guessedPos, newValue: candidate.pos },
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
