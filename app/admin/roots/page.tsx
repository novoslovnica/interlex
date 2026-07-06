import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AdminNav from "@/components/AdminNav"
import type { Metadata } from "next"
import RootsClient from "./roots-client"

export const metadata: Metadata = {
  title: "Корни | Админ-панель",
  description: "Управление корнями (морфемами) межславянского языка.",
}

const RootsPage = async () => {
  const session = await auth()
  if (!session) redirect("/login")

  const hasAccess = ["ADMIN", "MODERATOR"].includes(session.user.role || "")
  if (!hasAccess) {
    return <h1>Доступ запрещен. У вас нет прав на редактирование.</h1>
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <AdminNav userRole={session.user.role || ""} />
      <RootsClient />
    </div>
  )
}

export default RootsPage