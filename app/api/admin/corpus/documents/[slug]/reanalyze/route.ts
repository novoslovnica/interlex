import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { DbAnalyzer } from "@/lib/corpus/tokenizer/dbAnalyzer"
import { CollocationMatcher } from "@/lib/corpus/tokenizer/collocationMatcher"
import { buildValidEndings, buildKnownPrepositions, buildCollocationRecords, buildInflectionAnomalyIndex, createQueryWordsByBase } from "@/lib/corpus/tokenizer/analyzer-factory"
import { reanalyzeCorpusDocument } from "@/lib/corpus/reanalyzeDocument"
import { decodeSlugParam } from "@/lib/slug"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusBuilder))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { slug: rawSlug } = await params
  const slug = decodeSlugParam(rawSlug)

  try {
    const validEndings = await buildValidEndings()
    const knownPrepositions = await buildKnownPrepositions()
    const inflectionAnomalies = await buildInflectionAnomalyIndex()
    const analyzer = new DbAnalyzer(createQueryWordsByBase(), validEndings, knownPrepositions, inflectionAnomalies)
    const collocationMatcher = new CollocationMatcher(await buildCollocationRecords())

    const result = await reanalyzeCorpusDocument(slug, analyzer, collocationMatcher)
    if (!result) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("Reanalysis failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
