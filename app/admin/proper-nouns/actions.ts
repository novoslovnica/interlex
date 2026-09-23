"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { init } from "@/lib/sqlite"
import { applyProperNounDecisions, type ProperNounDecision } from "@/lib/community/properNounReview"

const MAX_BATCH = 200

export async function saveProperNounDecisionsAction(decisions: ProperNounDecision[]): Promise<{ success: boolean; error?: string; flagged?: number; lowercased?: number }> {
    const session = await auth()
    if (!(await checkPermission(session, Feature.WordsEdit))) return { success: false, error: "Forbidden" }
    if (!Array.isArray(decisions) || decisions.length === 0 || decisions.length > MAX_BATCH) return { success: false, error: "Bad batch" }
    if (!decisions.every((d) => Number.isInteger(d.lexemeId) && typeof d.proper === "boolean")) return { success: false, error: "Bad batch" }

    const db = await init()
    try {
        const result = applyProperNounDecisions(db, decisions, { id: session?.user?.id, email: session?.user?.email })
        revalidatePath("/admin/proper-nouns")
        return { success: true, ...result }
    } finally {
        db.close()
    }
}
