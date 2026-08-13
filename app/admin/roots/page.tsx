import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import RootsClient from "./roots-client"

export const metadata: Metadata = {
  title: "Корни | Админ-панель",
  description: "Управление корнями (морфемами) межславянского языка.",
}

const RootsPage = async () => {
  const session = await auth()
  if (!session) redirect("/login")

  await requirePermission(session, Feature.RootsEdit)

  return <RootsClient />
}

export default RootsPage
