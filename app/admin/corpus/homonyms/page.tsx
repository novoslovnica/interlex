import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import { countHomonymGroups, fetchHomonymGroups } from "@/lib/corpus/fetchHomonymGroups"
import HomonymsClient from "./homonyms-client"

export const metadata: Metadata = {
  title: "Омонимия корпуса — массовая разметка | Админ-панель",
  description: "Группы неоднозначных токенов: одно решение закрывает все токены группы (roadmap п.111).",
}

const PAGE_SIZE = 20

export default async function CorpusHomonymsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.CorpusTokenDisambiguate)

  const { page: pageStr, q } = await searchParams
  const search = (q ?? "").trim()
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)

  const [total, groups] = await Promise.all([
    countHomonymGroups(search || undefined),
    fetchHomonymGroups({ search: search || undefined, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }),
  ])

  return (
    <HomonymsClient
      groups={groups}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      search={search}
    />
  )
}
