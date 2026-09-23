"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { prismaData } from "@/lib/prisma"
import { init } from "@/lib/sqlite"
import { setCommentHidden } from "@/lib/community/comments"

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

// Жалоба на комментарий: скрыть его и закрыть жалобу одним действием.
// Два права: ReportsReview на очередь, CommentsModerate на само скрытие.
export async function hideCommentAction(reportId: number, commentId: number, moderatorNote?: string): Promise<ActionResult> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId || !(await checkPermission(session, Feature.ReportsReview)) || !(await checkPermission(session, Feature.CommentsModerate))) {
    return { success: false, error: "Forbidden" }
  }
  const db = await init()
  try {
    setCommentHidden(db, { commentId, hidden: true, moderatorUserId: userId, note: moderatorNote ?? null })
  } finally {
    db.close()
  }
  return resolveReportAction(reportId, moderatorNote)
}
