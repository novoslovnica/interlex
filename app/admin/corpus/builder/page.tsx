import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import CorpusBuilderClient from "../../corpus-builder/corpus-builder-client"

export const metadata: Metadata = {
  title: "Конструктор корпуса | Админ-панель",
  description: "Разметка текстов и сохранение в корпус межславянского языка.",
}

const CorpusBuilderPage = async () => {
  const session = await auth()
  if (!session) redirect("/login")

  await requirePermission(session, Feature.CorpusBuilder)

  return (
    <CorpusBuilderClient />
  )
}

export default CorpusBuilderPage