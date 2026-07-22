import { randomUUID } from "crypto"
import { prismaData } from "@/lib/prisma"

export interface FieldChange {
  field: string
  oldValue: unknown
  newValue: unknown
}

function serialize(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

/**
 * Records one audit_logs row per changed field, all sharing the same
 * actionId so they can be grouped back into "one save = one action" in the UI.
 * userId/userEmail are stored as a snapshot, not a foreign key — User lives
 * in auth.db, a separate database from audit_logs (data.db).
 */
export async function logAudit(
  user: { id?: string; email?: string | null } | null | undefined,
  entityType: string,
  entityId: number,
  changes: FieldChange[]
): Promise<void> {
  const meaningfulChanges = changes.filter((c) => serialize(c.oldValue) !== serialize(c.newValue))
  if (meaningfulChanges.length === 0) return

  const actionId = randomUUID()
  const userEmail = user?.email || "unknown"
  const userId = user?.id ?? null

  await prismaData.auditLog.createMany({
    data: meaningfulChanges.map((c) => ({
      actionId,
      entityType,
      entityId,
      field: c.field,
      oldValue: serialize(c.oldValue),
      newValue: serialize(c.newValue),
      userId,
      userEmail,
    })),
  })
}
