import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import EndingsClient from "./endings-client"

export const metadata: Metadata = {
  title: "Окончания | Админ-панель",
  description: "Управление окончаниями (флексиями) межславянского языка.",
}

const EndingsPage = async () => {
  const session = await auth()
  if (!session) redirect("/login")

  await requirePermission(session, Feature.EndingsEdit)

  return <EndingsClient />
}

export default EndingsPage
