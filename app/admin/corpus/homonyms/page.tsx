import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import { countHomonymGroups, fetchHomonymGroups } from "@/lib/corpus/fetchHomonymGroups"
import { fetchReviewBatches, withHomonymReviewDb } from "@/lib/corpus/homonymReview"
import HomonymsClient from "./homonyms-client"

export const metadata: Metadata = {
  title: "Омонимия корпуса — проверка контекстов | Админ-панель",
  description: "Группы неоднозначных токенов: контекстная проверка выбранных вхождений и откат пакетов.",
}

const PAGE_SIZE = 20

export default async function CorpusHomonymsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; batchPage?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.CorpusTokenDisambiguate)

  const { page: pageStr, q, batchPage: batchPageStr } = await searchParams
  const search = (q ?? "").trim()
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)

  const batchPage = Math.min(1_000_000, Math.max(1, parseInt(batchPageStr ?? "1", 10) || 1))
  const batches = withHomonymReviewDb((db) => fetchReviewBatches(db, (batchPage - 1) * 20, 21))

  const [total, groups] = await Promise.all([
    countHomonymGroups(search || undefined),
    fetchHomonymGroups({ search: search || undefined, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }),
  ])

  return (
    <HomonymsClient
      batches={batches.slice(0, 20)}
      batchPage={batchPage}
      hasMoreBatches={batches.length > 20}
      groups={groups}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      search={search}
    />
  )
}
