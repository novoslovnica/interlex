import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { type Feature } from "@/config/features"

type SessionUser = { role?: string | null; id?: string }

export async function requireRole(
  session: { user?: SessionUser } | null,
  allowedRoles: string[]
): Promise<void> {
  if (!session || !session.user?.role || !allowedRoles.includes(session.user.role)) {
    redirect("/unauthorized")
  }
}

export async function requirePermission(
  session: { user?: SessionUser } | null,
  featureKey: Feature
): Promise<void> {
  if (!session) redirect("/unauthorized")
  if (session.user?.role === "ADMIN") return
  if (session.user?.role !== "MODERATOR") redirect("/unauthorized")
  if (!session.user?.id) redirect("/unauthorized")

  const hasFeature = await dbAuth.featurePermission.findFirst({
    where: { userId: session.user.id, featureKey },
  })
  if (!hasFeature) redirect("/unauthorized")
}

export async function checkPermission(
  session: { user?: SessionUser } | null,
  featureKey: Feature
): Promise<boolean> {
  if (!session) return false
  if (session.user?.role === "ADMIN") return true
  if (session.user?.role !== "MODERATOR") return false
  if (!session.user?.id) return false

  const hasFeature = await dbAuth.featurePermission.findFirst({
    where: { userId: session.user.id, featureKey },
  })
  return !!hasFeature
}