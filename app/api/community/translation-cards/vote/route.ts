import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { init } from "@/lib/sqlite"
import { castVote, SUGGESTED_VALUE_MAX_LENGTH, VOTE_COMMENT_MAX_LENGTH, type CastVoteError } from "@/lib/community/translationCards"
import type { Verdict } from "@/lib/community/consensus"
import { castControlVote } from "@/lib/community/controlCards"
import { resolveCardKind } from "@/lib/community/cardToken"
import { checkVoteRateLimit, countVotesLastDay, getUserLanguageCodes, VOTES_PER_DAY } from "@/lib/community/access"

const VERDICTS = new Set<string>(["yes", "no", "unknown"])

const ERROR_STATUS: Record<CastVoteError, number> = {
    not_found: 404,
    language_mismatch: 400,
    // Карточку успели закрыть или на неё уже отвечали - не ошибка клиента,
    // он просто берёт следующую.
    closed: 409,
    already_voted: 409,
}

export async function POST(request: Request) {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rate = checkVoteRateLimit(userId)
    if (rate.limited) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } })
    }

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const translationId = Number(body.translationId)
    const language = typeof body.language === "string" ? body.language : ""
    const verdict = typeof body.verdict === "string" ? body.verdict : ""
    const suggestedValue = typeof body.suggestedValue === "string" ? body.suggestedValue : null
    const comment = typeof body.comment === "string" ? body.comment : null
    const token = typeof body.token === "string" ? body.token : ""

    if (!Number.isInteger(translationId) || translationId <= 0) {
        return NextResponse.json({ error: "translationId is required" }, { status: 400 })
    }
    // Вид карточки (обычная/контрольная) сервер узнаёт только из подписи,
    // выданной вместе с карточкой; без неё ответ не принимается.
    const kind = resolveCardKind(token, translationId, userId)
    if (!kind) return NextResponse.json({ error: "Invalid card token" }, { status: 400 })
    if (!VERDICTS.has(verdict)) {
        return NextResponse.json({ error: "verdict must be one of: yes, no, unknown" }, { status: 400 })
    }
    if ((suggestedValue?.length ?? 0) > SUGGESTED_VALUE_MAX_LENGTH || (comment?.length ?? 0) > VOTE_COMMENT_MAX_LENGTH) {
        return NextResponse.json({ error: "Text is too long" }, { status: 400 })
    }

    const languages = await getUserLanguageCodes(userId)
    if (!languages.includes(language)) {
        return NextResponse.json({ error: "Language is not among your languages" }, { status: 403 })
    }

    const db = await init()
    try {
        if (countVotesLastDay(db, userId) >= VOTES_PER_DAY) {
            return NextResponse.json({ error: "Daily limit reached" }, { status: 429 })
        }
        if (kind !== "regular") {
            const control = castControlVote(db, { userId, translationId, language, verdict: verdict as Verdict, kind })
            if (!control.ok) return NextResponse.json({ error: control.error }, { status: ERROR_STATUS[control.error] })
            // Тот же ответ, что у обычной карточки без исхода: участнику не
            // сообщается ни что карточка была контрольной, ни угадал ли он.
            return NextResponse.json({ ok: true, status: null })
        }
        const result = castVote(db, { userId, translationId, language, verdict: verdict as Verdict, suggestedValue, comment })
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: ERROR_STATUS[result.error] })
        return NextResponse.json({ ok: true, status: result.status })
    } finally {
        db.close()
    }
}
