import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"

// Public, unauthenticated endpoint behind the "suggest a word" form
// (roadmap item 49) - anonymous submissions are allowed by design (see
// AGENTS.md), rate-limited more tightly than the general API surface in
// proxy.ts (PUBLIC_WRITE_PATHS). Session is only used to attach
// submitterUserId automatically when the visitor happens to be logged in;
// it is never required. Writes to the lightweight WordSuggestion staging
// table, not directly to Candidate - see prisma/data.schema.prisma comment
// on WordSuggestion for why the two are kept separate.
const MAX_SHORT_LENGTH = 200
const MAX_MEANING_LENGTH = 1000
const MAX_EXAMPLE_LENGTH = 500
const MAX_CONTACT_LENGTH = 200

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { suggestedValue, meaningText, exampleSentence, sourceNote, submitterContact } = body

    if (typeof meaningText !== "string" || !meaningText.trim()) {
      return NextResponse.json({ error: "meaningText is required" }, { status: 400 })
    }
    if (meaningText.length > MAX_MEANING_LENGTH) {
      return NextResponse.json({ error: "meaningText too long" }, { status: 400 })
    }
    if (typeof suggestedValue === "string" && suggestedValue.length > MAX_SHORT_LENGTH) {
      return NextResponse.json({ error: "suggestedValue too long" }, { status: 400 })
    }
    if (typeof exampleSentence === "string" && exampleSentence.length > MAX_EXAMPLE_LENGTH) {
      return NextResponse.json({ error: "exampleSentence too long" }, { status: 400 })
    }
    if (typeof sourceNote === "string" && sourceNote.length > MAX_SHORT_LENGTH) {
      return NextResponse.json({ error: "sourceNote too long" }, { status: 400 })
    }
    if (typeof submitterContact === "string" && submitterContact.length > MAX_CONTACT_LENGTH) {
      return NextResponse.json({ error: "Contact too long" }, { status: 400 })
    }

    const session = await auth()

    const suggestion = await db.wordSuggestion.create({
      data: {
        suggestedValue: typeof suggestedValue === "string" ? suggestedValue.trim() || null : null,
        meaningText: meaningText.trim(),
        exampleSentence: typeof exampleSentence === "string" ? exampleSentence.trim() || null : null,
        sourceNote: typeof sourceNote === "string" ? sourceNote.trim() || null : null,
        submitterUserId: session?.user?.id ?? null,
        submitterContact: session?.user ? null : (typeof submitterContact === "string" ? submitterContact.trim() || null : null),
      },
    })

    return NextResponse.json({ id: suggestion.id }, { status: 201 })
  } catch (error) {
    console.error("API WordSuggestion CREATE Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
