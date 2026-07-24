import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import SemanticFieldPage from "./_page"

export const metadata: Metadata = {
  title: "Семантическое поле | Админ-панель",
  description: "Ядро и периферия семантического поля слова по данным корпуса.",
}

const SemanticFieldPageWrapper = async () => {
  const session = await auth()
  if (!session) redirect("/login")

  await requirePermission(session, Feature.CorpusBuilder)

  return <SemanticFieldPage />
}

export default SemanticFieldPageWrapper
