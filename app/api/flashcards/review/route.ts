import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaAuth } from "@/lib/prisma"
import { sm2Review, DEFAULT_SRS_STATE, QUALITY_BY_BUTTON, type ReviewButton } from "@/lib/srs/sm2"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const wordId = Number(body?.wordId)
    const button = body?.button as ReviewButton

    if (!Number.isFinite(wordId)) {
      return NextResponse.json({ error: "wordId is required" }, { status: 400 })
    }
    if (!(button in QUALITY_BY_BUTTON)) {
      return NextResponse.json({ error: "button must be one of: again, hard, good, easy" }, { status: 400 })
    }

    const userId = session.user.id
    const existing = await prismaAuth.flashcardProgress.findUnique({
      where: { userId_wordId: { userId, wordId } },
    })

    const priorState = existing
      ? { easeFactor: existing.easeFactor, intervalDays: existing.intervalDays, repetitions: existing.repetitions }
      : DEFAULT_SRS_STATE

    const now = new Date()
    const result = sm2Review(priorState, QUALITY_BY_BUTTON[button], now)

    const updated = await prismaAuth.flashcardProgress.upsert({
      where: { userId_wordId: { userId, wordId } },
      update: {
        easeFactor: result.easeFactor,
        intervalDays: result.intervalDays,
        repetitions: result.repetitions,
        nextReviewAt: result.nextReviewAt,
        lastReviewedAt: now,
      },
      create: {
        userId,
        wordId,
        easeFactor: result.easeFactor,
        intervalDays: result.intervalDays,
        repetitions: result.repetitions,
        nextReviewAt: result.nextReviewAt,
        lastReviewedAt: now,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("API Flashcards Review POST Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
