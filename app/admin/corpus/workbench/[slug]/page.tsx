import { auth } from "@/auth"
import { notFound, redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { decodeSlugParam } from "@/lib/slug"
import { withHomonymReviewDb } from "@/lib/corpus/homonymReview"
import WorkbenchClient from "./workbench-client"
export default async function WorkbenchPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.CorpusTokenDisambiguate)
  const userKey = session.user?.id || session.user?.email
  if (!userKey) redirect("/login")
  const slug = decodeSlugParam((await params).slug)
  const doc = withHomonymReviewDb((db) => db.prepare("SELECT slug, title FROM CorpusDocument WHERE slug = ?").get(slug) as { slug: string; title: string } | undefined)
  if (!doc) notFound()
  return <WorkbenchClient slug={doc.slug} title={doc.title} userKey={userKey} />
}
