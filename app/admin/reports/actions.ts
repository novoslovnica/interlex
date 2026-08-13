"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { prismaData } from "@/lib/prisma"

interface ActionResult {
  success: boolean
  error?: string
}

export async function resolveReportAction(reportId: number, moderatorNote?: string): Promise<ActionResult> {
  const session = await auth()
  if (!(await checkPermission(session, Feature.ReportsReview))) {
    return { success: false, error: "Forbidden" }
  }

  await prismaData.contentReport.update({
    where: { id: reportId },
    data: {
      status: "resolved",
      moderatorNote: moderatorNote ?? null,
      resolvedByUserId: session?.user?.id ?? null,
      resolvedAt: new Date(),
    },
  })

  revalidatePath("/admin/reports")
  return { success: true }
}

export async function dismissReportAction(reportId: number, moderatorNote?: string): Promise<ActionResult> {
  const session = await auth()
  if (!(await checkPermission(session, Feature.ReportsReview))) {
    return { success: false, error: "Forbidden" }
  }

  await prismaData.contentReport.update({
    where: { id: reportId },
    data: {
      status: "dismissed",
      moderatorNote: moderatorNote ?? null,
      resolvedByUserId: session?.user?.id ?? null,
      resolvedAt: new Date(),
    },
  })

  revalidatePath("/admin/reports")
  return { success: true }
}
