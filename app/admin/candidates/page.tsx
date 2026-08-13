import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import CandidatesClient from "./candidates-client"

export const metadata: Metadata = {
  title: "Кандидаты | Админ-панель",
  description: "Управление кандидатами в лексикон межславянского языка.",
}

const CandidatesPage = async () => {
  const session = await auth()
  if (!session) redirect("/login")

  await requirePermission(session, Feature.CandidatesPromote)

  return <CandidatesClient />
}

export default CandidatesPage