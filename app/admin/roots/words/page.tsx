import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import WordsClient from "./words-client"

export const metadata: Metadata = {
  title: "Слова корня | Админ-панель",
  description: "Массовое управление словами, привязанными к корням.",
}

const RootsWordsPage = async () => {
  const session = await auth()
  if (!session) redirect("/login")

  await requirePermission(session, Feature.RootsEdit)

  return <WordsClient />
}

export default RootsWordsPage
