import { NextRequest, NextResponse } from "next/server"
import { prismaData } from "@/lib/prisma"
import { decodeSlugParam } from "@/lib/slug"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params
  const slug = decodeSlugParam(rawSlug)

  const lexeme = await prismaData.lexeme.findUnique({
    where: { slug },
    select: {
      slug: true,
      value: true,
      pos: true,
      gender: true,
      aspect: true,
      transitivity: true,
      animacy: true,
      degree: true,
      pronType: true,
      numType: true,
      paradigm: true,
      protoStemClass: true,
      stemExtension: true,
      stem: true,
      secondaryStem: true,
      frequency: true,
      intelligibility: true,
      etymology: true,
      proto: true,
      corpusFrequency: true,
      corpusFrequencyPerMln: true,
      corpusRank: true,
      corpusHapax: true,
    },
  })

  if (!lexeme) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 })
  }

  return NextResponse.json(lexeme)
}