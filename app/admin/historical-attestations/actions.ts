"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { prismaHistorical } from "@/lib/prisma"

interface ActionResult {
  success: boolean
  error?: string
}

// HistoricalAttestation живёт в historical.db, не в data.schema.prisma —
// logAudit (см. AGENTS.md "Audit Logging") тут сознательно не вызывается,
// это отдельная область: аудит-лог покрывает только data.schema.prisma
// модели, а тут ничего не создаётся и не удаляется в interlex.db — только
// подтверждается/отклоняется уже существующая ссылка на лексему.

export async function confirmAttestationAction(id: number): Promise<ActionResult> {
  const session = await auth()
  if (!(await checkPermission(session, Feature.HistoricalAttestationsReview))) {
    return { success: false, error: "Forbidden" }
  }

  const attestation = await prismaHistorical.historicalAttestation.findUnique({ where: { id } })
  if (!attestation) return { success: false, error: "Запись не найдена" }
  if (attestation.status !== "proposed") return { success: false, error: "Уже обработано" }

  await prismaHistorical.historicalAttestation.update({
    where: { id },
    data: { status: "manually_confirmed" },
  })

  revalidatePath("/admin/historical-attestations")
  return { success: true }
}

// Переназначает аттестацию на другую лексему (модератор нашёл её сам через
// поиск, а не выбирает из auto-предложенной). Полностью заменяет исходную
// привязку — старая предложенная лексема просто отбрасывается, отдельно
// отклонять её не нужно. matchMethod='manual' и status='manually_confirmed'
// сразу — повторный прогон матчера эту запись больше не тронет.
//
// (branch, historicalLemma, lexemeId) уникален — если для этой же историч.
// леммы УЖЕ есть запись на целевую лексему (её независимо нашёл матчер),
// прямой update столкнётся с конфликтом уникальности; в этом случае вместо
// ошибки просто подтверждаем существующую запись и удаляем текущую (дублей
// смысла для одной и той же пары лемма+лексема быть не должно).
export async function reassignAttestationAction(id: number, newLexemeId: number): Promise<ActionResult> {
  const session = await auth()
  if (!(await checkPermission(session, Feature.HistoricalAttestationsReview))) {
    return { success: false, error: "Forbidden" }
  }

  const attestation = await prismaHistorical.historicalAttestation.findUnique({ where: { id } })
  if (!attestation) return { success: false, error: "Запись не найдена" }
  if (attestation.status !== "proposed") return { success: false, error: "Уже обработано" }

  const conflict = await prismaHistorical.historicalAttestation.findUnique({
    where: { branch_historicalLemma_lexemeId: { branch: attestation.branch, historicalLemma: attestation.historicalLemma, lexemeId: newLexemeId } },
  })

  if (conflict) {
    await prismaHistorical.$transaction([
      prismaHistorical.historicalAttestation.update({
        where: { id: conflict.id },
        data: { status: "manually_confirmed", matchMethod: "manual" },
      }),
      prismaHistorical.historicalAttestation.delete({ where: { id: attestation.id } }),
    ])
  } else {
    await prismaHistorical.historicalAttestation.update({
      where: { id },
      data: { lexemeId: newLexemeId, matchMethod: "manual", status: "manually_confirmed", confidence: 1 },
    })
  }

  revalidatePath("/admin/historical-attestations")
  return { success: true }
}

export async function rejectAttestationAction(id: number, note?: string): Promise<ActionResult> {
  const session = await auth()
  if (!(await checkPermission(session, Feature.HistoricalAttestationsReview))) {
    return { success: false, error: "Forbidden" }
  }

  const attestation = await prismaHistorical.historicalAttestation.findUnique({ where: { id } })
  if (!attestation) return { success: false, error: "Запись не найдена" }
  if (attestation.status !== "proposed") return { success: false, error: "Уже обработано" }

  await prismaHistorical.historicalAttestation.update({
    where: { id },
    data: { status: "rejected", note: note ?? null },
  })

  revalidatePath("/admin/historical-attestations")
  return { success: true }
}
