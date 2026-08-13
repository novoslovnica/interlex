import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { listAllApiKeysForAdmin, setApiKeyRateLimitOverride, revokeApiKeyByAdmin } from "@/lib/apiKeys"
import { PUBLIC_API_RATE_LIMITS } from "@/lib/publicApi/rateLimit"
import type { Metadata } from "next"
import { ApiKeysAdminClient } from "./client"

export const metadata: Metadata = {
  title: "API-ключи — администрирование",
  description: "Управление API-ключами всех пользователей (roadmap п.38).",
}

export default async function AdminApiKeysPage() {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.ApiKeysManage)

  const keys = await listAllApiKeysForAdmin()

  async function setOverride(formData: FormData) {
    "use server"
    const s = await auth()
    if (!s) throw new Error("Unauthorized")
    await requirePermission(s, Feature.ApiKeysManage)

    const id = formData.get("id") as string
    const raw = (formData.get("rateLimitOverride") as string) || ""
    const value = raw.trim() === "" ? null : parseInt(raw, 10)
    if (value !== null && (!Number.isFinite(value) || value <= 0)) return
    await setApiKeyRateLimitOverride(id, value)
  }

  async function revoke(formData: FormData) {
    "use server"
    const s = await auth()
    if (!s) throw new Error("Unauthorized")
    await requirePermission(s, Feature.ApiKeysManage)

    const id = formData.get("id") as string
    await revokeApiKeyByAdmin(id)
  }

  return (
      <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold">API-ключи</h1>
          <span className="text-xs text-muted-foreground">
            Дефолты по категориям: словарь {PUBLIC_API_RATE_LIMITS.words}/мин · библиотека {PUBLIC_API_RATE_LIMITS.library}/мин · корпус {PUBLIC_API_RATE_LIMITS.corpus}/мин
          </span>
        </div>
        <ApiKeysAdminClient keys={keys} setOverride={setOverride} revoke={revoke} />
      </div>
  )
}
