import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import AdminNav from "@/components/AdminNav"
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

  const userPermissions = session.user.role === "MODERATOR"
      ? (await dbAuth.featurePermission.findMany({
          where: { userId: session.user.id },
          select: { featureKey: true },
        })).map(p => p.featureKey)
      : []

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
      <WordsClient />
    </div>
  )
}

export default RootsWordsPage