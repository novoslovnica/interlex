import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaAuth } from "@/lib/prisma"
import { fetchFlashcardSession } from "@/lib/srs/fetchFlashcardSession"
import { TRANSLATION_LANGUAGE_CODES } from "@/lib/translations"

const DEFAULT_LANGUAGE = "en"
const MAX_SESSION_SIZE = 50

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cefrLevel = req.nextUrl.searchParams.get("cefrLevel") || null
  const limitParam = Number(req.nextUrl.searchParams.get("limit"))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_SESSION_SIZE) : undefined

  let language = req.nextUrl.searchParams.get("lang")
  if (!language) {
    const settings = await prismaAuth.userSettings.findUnique({ where: { userId: session.user.id } })
    language = settings?.language ?? DEFAULT_LANGUAGE
  }
  // UserSettings.language also holds "isv" (site UI locale) - not a valid
  // translation target (ISV is the source language, not something words are
  // translated into), so fall back to the default in that case.
  if (!(TRANSLATION_LANGUAGE_CODES as readonly string[]).includes(language)) {
    language = DEFAULT_LANGUAGE
  }

  try {
    const cards = await fetchFlashcardSession(session.user.id, cefrLevel, language, limit)
    return NextResponse.json({ cards })
  } catch (error) {
    console.error("API Flashcards Session GET Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
