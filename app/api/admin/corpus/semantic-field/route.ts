import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { computeCollocations, DEFAULT_WINDOW } from "@/lib/corpus/collocations/compute-collocations"
import { crossReferenceRelations } from "@/lib/corpus/collocations/relation-crossref"

export async function GET(request: Request) {
  const session = await auth()
  if (!(await checkPermission(session, Feature.CorpusBuilder))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get("slug")
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 })

  const windowParam = Number(searchParams.get("window"))
  const window = Number.isFinite(windowParam) && windowParam > 0 ? windowParam : DEFAULT_WINDOW

  const analysis = await computeCollocations(slug, window)
  const existingRelationsBySlug = await crossReferenceRelations(
    slug,
    analysis.collocates.map((c) => c.slug),
  )

  return NextResponse.json({
    ...analysis,
    collocates: analysis.collocates.map((c) => ({
      ...c,
      existingRelations: existingRelationsBySlug.get(c.slug) ?? [],
    })),
  })
}
