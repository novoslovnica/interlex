import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AdminNav from "@/components/AdminNav"
import type { Metadata } from "next"
import CandidatesClient from "./candidates-client"

export const metadata: Metadata = {
  title: "Кандидаты | Админ-панель",
  description: "Управление кандидатами в лексикон межславянского языка.",
}

const CandidatesPage = async () => {
  const session = await auth()
  if (!session) redirect("/login")

  const hasAccess = ["ADMIN", "MODERATOR"].includes(session.user.role || "")
  if (!hasAccess) {
    return <h1>Доступ запрещен. У вас нет прав на редактирование.</h1>
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <AdminNav userRole={session.user.role || ""} />
      <CandidatesClient />
    </div>
  )
}

export default CandidatesPage