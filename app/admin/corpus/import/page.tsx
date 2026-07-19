import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import CorpusImportClient from "./corpus-import-client"

export const metadata: Metadata = {
  title: "Импорт корпуса | Админ-панель",
  description: "Массовый импорт текстов в корпус межславянского языка.",
}

export default async function CorpusImportPage() {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.CorpusBuilder)
  return <CorpusImportClient />
}