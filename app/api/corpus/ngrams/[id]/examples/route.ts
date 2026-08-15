import { NextRequest, NextResponse } from "next/server"
import { prismaCorpus } from "@/lib/prisma"
import { findNgramExamples } from "@/lib/corpus/collocations/findNgramExamples"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ngramId = Number(id)
  if (!Number.isFinite(ngramId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const ngram = await prismaCorpus.corpusNgram.findUnique({ where: { id: ngramId } })
  if (!ngram) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const slugs = ngram.slugs as string[]
  const examples = await findNgramExamples(slugs, 5)

  return NextResponse.json({ examples })
}
