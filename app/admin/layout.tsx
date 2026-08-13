import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/permissions"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import AdminNav from "@/components/AdminNav"

// Centralizes what every /admin/** page used to do individually: fetch the
// session, gate by role, load a MODERATOR's feature permissions, and render
// AdminNav. Was previously duplicated across ~20 top-level page.tsx files
// plus two more separate nav components for /admin/platform/** and
// /admin/corpus/** (PlatformAdminNav, CorpusAdminNav) - those two nested
// layouts are now gone, this is the single nav for the whole /admin tree.
//
// This is a role-only gate (ADMIN/MODERATOR), matching proxy.ts's coarse
// middleware check - it does NOT replace each page's own
// requirePermission(session, Feature.X) call for the specific action that
// page performs. A moderator with zero feature permissions still passes
// this layout (so they can reach the Home hub) but is redirected by the
// individual page they try to open, exactly as before.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  await requireRole(session, ["ADMIN", "MODERATOR"])

  const userPermissions = session.user.role === "MODERATOR"
    ? (await dbAuth.featurePermission.findMany({
        where: { userId: session.user.id },
        select: { featureKey: true },
      })).map((p) => p.featureKey)
    : []

  return (
    <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
      <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
      {children}
    </div>
  )
}
