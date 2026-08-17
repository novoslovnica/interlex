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
  morphemeId?: number
}

/**
 * Материализует одно предложение RootDiscoveryProposal в реальный корень:
 * создаёт Morpheme (type=0) + LexemeMorpheme для каждой лексемы кластера.
 * Прото-предложение (если было и модератор его подтвердил) переносится на
 * новый корень как protoSlavicWordId напрямую — иначе как черновик
 * protoSuggestion* для последующего ревью в /admin/roots, тем же
 * механизмом, что и Phase B (scripts/roots-discovery/match-roots-to-proto.ts).
 */
export async function approveRootDiscoveryAction(
  proposalId: number,
  editedValue?: string,
  acceptProtoSuggestion?: boolean
): Promise<ActionResult> {
  const session = await auth()
  if (!(await checkPermission(session, Feature.RootDiscoveryReview))) {
    return { success: false, error: "Forbidden" }
  }

  const proposal = await prismaData.rootDiscoveryProposal.findUnique({ where: { id: proposalId } })
  if (!proposal) return { success: false, error: "Предложение не найдено" }
  if (proposal.status !== "pending") return { success: false, error: "Уже обработано" }

  const value = (editedValue ?? proposal.proposedValue).trim()
  if (!value) return { success: false, error: "Значение корня не может быть пустым" }

  const memberLexemeIds = proposal.memberLexemeIds as number[]

  const morpheme = await prismaData.morpheme.create({
    data: {
      value,
      type: 0,
      ...(acceptProtoSuggestion && proposal.protoSuggestionId
        ? { protoSlavicWordId: proposal.protoSuggestionId }
        : proposal.protoSuggestionId
          ? {
              protoSuggestionId: proposal.protoSuggestionId,
              protoSuggestionScore: proposal.protoSuggestionScore,
              protoSuggestionStatus: "pending",
            }
          : {}),
    },
  })

  await prismaData.lexemeMorpheme.createMany({
    data: memberLexemeIds.map((lexemeId) => ({ lexemeId, morphemeId: morpheme.id })),
  })

  await logAudit(session?.user, "Morpheme", morpheme.id, [
    { field: "createdFromRootDiscoveryProposal", oldValue: null, newValue: proposal.clusterKey },
    { field: "value", oldValue: null, newValue: value },
    { field: "type", oldValue: null, newValue: 0 },
    { field: "memberLexemeCount", oldValue: null, newValue: memberLexemeIds.length },
  ])

  const now = new Date()
  await prismaData.rootDiscoveryProposal.update({
    where: { id: proposal.id },
    data: {
      status: "approved",
      createdMorphemeId: morpheme.id,
      reviewedByUserId: session?.user?.id ?? null,
      reviewedAt: now,
    },
  })

  revalidatePath("/admin/root-discovery")
  return { success: true, morphemeId: morpheme.id }
}

/**
 * Отклоняет предложение — кластер не подходит как новый корень (ложное
 * срабатывание кластеризации, случайное совпадение остатков после снятия
 * аффиксов и т.п.). Помеченные rejected никогда больше не всплывают в
 * очереди "pending", сколько раз ни перезапускай
 * scripts/roots-discovery/discover-new-roots.ts (upsert не трогает status).
 */
export async function rejectRootDiscoveryAction(
  proposalId: number,
  resolutionNote?: string
): Promise<ActionResult> {
  const session = await auth()
  if (!(await checkPermission(session, Feature.RootDiscoveryReview))) {
    return { success: false, error: "Forbidden" }
  }

  const proposal = await prismaData.rootDiscoveryProposal.findUnique({ where: { id: proposalId } })
  if (!proposal) return { success: false, error: "Предложение не найдено" }
  if (proposal.status !== "pending") return { success: false, error: "Уже обработано" }

  await prismaData.rootDiscoveryProposal.update({
    where: { id: proposalId },
    data: {
      status: "rejected",
      resolutionNote: resolutionNote ?? null,
      reviewedByUserId: session?.user?.id ?? null,
      reviewedAt: new Date(),
    },
  })

  revalidatePath("/admin/root-discovery")
  return { success: true }
}
