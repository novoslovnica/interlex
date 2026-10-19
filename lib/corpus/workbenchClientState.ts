import type { QueueToken } from "./workbench"
export interface Position { id: string; surfaceForm: string; tokenIndex: number }
export interface SavedWorkspace { position?: Position; deferred: Position[]; filter: "problems" | "all" | "manual"; script: "original" | "latin" | "cyrillic" }
export const samePosition = (a: Position, b: Position) => a.id === b.id && a.surfaceForm === b.surfaceForm && a.tokenIndex === b.tokenIndex
export const positionOf = (t: QueueToken): Position => ({ id: t.id, surfaceForm: t.surfaceForm, tokenIndex: t.tokenIndex })
export function readWorkspace(raw: string | null): SavedWorkspace {
  const empty: SavedWorkspace = { deferred: [], filter: "problems", script: "original" }
  try {
    const v: unknown = JSON.parse(raw || "null")
    if (!v || typeof v !== "object" || !("version" in v) || v.version !== 1) return empty
    const position = (p: unknown): p is Position => !!p && typeof p === "object" && "id" in p && typeof p.id === "string" && /^[1-9]\d{0,18}$/.test(p.id) && "surfaceForm" in p && typeof p.surfaceForm === "string" && p.surfaceForm.length <= 1000 && "tokenIndex" in p && Number.isSafeInteger(p.tokenIndex)
    return {
      ...empty,
      ...("position" in v && position(v.position) ? { position: v.position } : {}),
      deferred: "deferred" in v && Array.isArray(v.deferred) ? v.deferred.filter(position).slice(0, 500) : [],
      filter: "filter" in v && (v.filter === "all" || v.filter === "manual") ? v.filter : "problems",
      script: "script" in v && (v.script === "latin" || v.script === "cyrillic") ? v.script : "original",
    }
  } catch { return empty }
}
export function shortcut(event: { key: string; code?: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }, editing: boolean): "save" | "saveNext" | "next" | "previous" | "defer" | number | null {
  if (event.altKey || event.shiftKey) return null
  const key = event.code?.startsWith("Key") ? event.code.slice(3).toLowerCase() : event.key
  if (event.ctrlKey || event.metaKey) {
    if (key.toLowerCase() === "s") return "save"
    if (key === "Enter") return "saveNext"
    return null
  }
  if (editing) return null
  if (/^[1-9]$/.test(key)) return Number(key) - 1
  if (key === "j" || key === "ArrowRight") return "next"
  if (key === "k" || key === "ArrowLeft") return "previous"
  if (key.toLowerCase() === "d") return "defer"
  return null
}
