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
