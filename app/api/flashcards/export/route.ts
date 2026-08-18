import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaAuth } from "@/lib/prisma"
import { fetchFlashcardSession } from "@/lib/srs/fetchFlashcardSession"
import { TRANSLATION_LANGUAGE_CODES } from "@/lib/translations"
import { isvToCyr } from "@/lib/isv"
import { buildApkg } from "@/lib/anki/apkg"

const DEFAULT_LANGUAGE = "en"
const MAX_EXPORT_SIZE = 1000

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cefrLevel = req.nextUrl.searchParams.get("cefrLevel") || null

  let language = req.nextUrl.searchParams.get("lang")
  if (!language) {
    const settings = await prismaAuth.userSettings.findUnique({ where: { userId: session.user.id } })
    language = settings?.language ?? DEFAULT_LANGUAGE
  }
  if (!(TRANSLATION_LANGUAGE_CODES as readonly string[]).includes(language)) {
    language = DEFAULT_LANGUAGE
  }

  try {
    const cards = await fetchFlashcardSession(session.user.id, cefrLevel, language, MAX_EXPORT_SIZE)

    if (cards.length === 0) {
      return NextResponse.json({ error: "No cards to export" }, { status: 404 })
    }

    const deckName = cefrLevel ? `Interlex — ${cefrLevel}` : "Interlex"
    const notes = cards.map((card) => {
      const cyrillic = isvToCyr(card.value)
      const backParts = [card.translation || "—"]
      if (card.pos) backParts.push(`(${card.pos})`)
      return {
        front: `${card.value}${cyrillic ? ` — ${cyrillic}` : ""}`,
        back: backParts.join(" "),
      }
    })

    const apkg = buildApkg(deckName, notes)
    const filename = `interlex-flashcards${cefrLevel ? `-${cefrLevel}` : ""}.apkg`

    return new NextResponse(new Uint8Array(apkg), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("API Flashcards Export GET Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
