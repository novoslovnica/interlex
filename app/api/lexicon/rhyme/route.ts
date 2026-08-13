import { NextResponse } from "next/server"
import { init } from "@/lib/sqlite"
import { searchRhymes } from "@/lib/rhyme"
import { standardToSimple } from "@/lib/isv"
import { mapNslToEtymologized } from "@/lib/nsl"

// Публичный, read-only (roadmap п.43) - тот же уровень доступа, что у
// forward/reverse поиска лексикона. Общий лимитер /api/** в proxy.ts уже
// достаточен, отдельный строгий лимит (как у /api/reports, /api/suggestions)
// не нужен - это чтение, а не запись.
const MAX_WORD_LENGTH = 100

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const raw = (searchParams.get("word") || "").trim()

    if (!raw) {
      return NextResponse.json({ error: "word is required" }, { status: 400 })
    }
    if (raw.length > MAX_WORD_LENGTH) {
      return NextResponse.json({ error: "word too long" }, { status: 400 })
    }

    // Та же детекция кириллицы/латиницы, что уже использует /lexicon
    // (app/lexicon/Home.tsx) при переходе по прямой ссылке с ?q=...
    const isCyrillic = /[а-яА-ЯёЁ]/.test(raw)
    const normalized = isCyrillic ? standardToSimple(mapNslToEtymologized(raw)) : raw

    const db = await init()
    const result = searchRhymes(db, normalized)

    return NextResponse.json(result)
  } catch (error) {
    console.error("API Rhyme Search Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
