"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { init } from "@/lib/sqlite"
import { logAudit } from "@/lib/audit-log"
import { TRANSLATION_LANGUAGE_CODES } from "@/lib/translations"
import { resolveReview, type ReviewAction } from "@/lib/community/moderatorReview"

interface ActionResult {
    success: boolean
    error?: string
}

const MAX_VALUE_LENGTH = 500

// Два права: CommunityReview - видеть очередь, translate_<язык> - менять
// перевод на этом языке (то же право, что у правки перевода в таблице
// /admin/translations - очередь не должна быть обходным путём мимо него).
export async function resolveReviewAction(translationId: number, language: string, action: ReviewAction): Promise<ActionResult> {
    const session = await auth()
    if (!(TRANSLATION_LANGUAGE_CODES as readonly string[]).includes(language)) return { success: false, error: "Invalid language" }
    if (!(await checkPermission(session, Feature.CommunityReview)) || !(await checkPermission(session, `translate_${language}` as Feature))) {
        return { success: false, error: "Forbidden" }
    }
    if (!Number.isInteger(translationId)) return { success: false, error: "Invalid translation" }
    if (action.kind === "replace" && action.value.length > MAX_VALUE_LENGTH) return { success: false, error: "Value is too long" }

    const db = await init()
    let result
    try {
        // Язык сверяется с фактическим внутри: право проверено на language,
        // значит и перевод обязан быть на нём.
        const row = db.prepare(`SELECT language FROM translations WHERE id = ?`).get(translationId) as { language: string } | undefined
        if (!row || row.language !== language) return { success: false, error: "not_found" }
        result = resolveReview(db, translationId, action)
    } finally {
        db.close()
    }
    if (!result.ok) return { success: false, error: result.error }

    await logAudit(session?.user, "Lexeme", result.lexemeId, result.changes)
    revalidatePath("/admin/community-review")
    return { success: true }
}
