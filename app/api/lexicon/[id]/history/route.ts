import { NextRequest, NextResponse } from "next/server"
import { loadWordHistory, WORD_HISTORY_PAGE } from "@/lib/community/loadWordHistory"

// Публично, без сессии: то же, что страница слова показывает в секции
// "История" (roadmap п.61) - только следующие страницы. Лимит по IP даёт
// общий /api-бакет в proxy.ts.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const lexemeId = Number(id)
    if (!Number.isInteger(lexemeId) || lexemeId <= 0) return NextResponse.json({ error: "Bad id" }, { status: 400 })
    const offset = Math.max(0, Number(new URL(request.url).searchParams.get("offset")) || 0)
    const result = await loadWordHistory(lexemeId, { offset, limit: WORD_HISTORY_PAGE })
    return NextResponse.json(result)
}
