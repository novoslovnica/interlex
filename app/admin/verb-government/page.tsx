import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import VerbGovernmentClient from "./verb-government-client"

export const metadata: Metadata = {
  title: "Управление глаголов | Админ-панель",
  description: "Ввод фактов падежного управления глаголов для дизамбигуации корпуса и синтаксис-парсера.",
}

const VerbGovernmentPage = async () => {
  const session = await auth()
  if (!session) redirect("/login")

  await requirePermission(session, Feature.VerbGovernmentEdit)

  return <VerbGovernmentClient />
}

export default VerbGovernmentPage
