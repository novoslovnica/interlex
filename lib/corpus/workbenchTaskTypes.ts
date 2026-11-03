export const DEFER_REASONS = {
  missing_lexeme: "Нет лексемы в словаре", typo: "Возможная опечатка",
  analyzer: "Возможная ошибка анализатора", consultation: "Нужна консультация", context: "Недостаточно контекста", other: "Другая причина",
} as const
export type DeferReason = keyof typeof DEFER_REASONS
export interface ReviewTaskRecord {
  id: string; userId: string; documentSlug: string; tokenId: string; tokenIndex: number
  surfaceForm: string; sentenceText: string; ordinal: number; reason: DeferReason; note: string
  tokenRevision: string; tokenStamp: string; state: string; version: string; proposalKey: string | null; proposalSeenStatus: string | null
  completedByEditId: string | null; createdAt: string; updatedAt: string
}
export interface ReviewTask extends Pick<ReviewTaskRecord, "id" | "documentSlug" | "tokenId" | "tokenIndex" | "surfaceForm" | "reason" | "note" | "version" | "proposalKey" | "createdAt" | "updatedAt"> {
  status: "deferred" | "ready" | "conflict" | "closed"
  proposalId: number | null; proposalStatus: string | null
}
