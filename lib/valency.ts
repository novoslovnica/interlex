import type Database from "better-sqlite3"
import { isValidCase } from "@/lib/grammar/common/case"
import type { FieldChange } from "@/lib/audit-log"

export interface ValencyArgumentInput {
  id: number
  case: string
  preposition: string
  role: string
  isOptional: boolean
}

export interface ValencyFrameInput {
  id: number
  label: string
  arguments: ValencyArgumentInput[]
}

function snapshot(db: Database.Database, meaningId: number): string {
  const rows = db.prepare(`
    SELECT vf.id AS frameId, vf.label, va.id AS argId, va.role, va."case" AS "case", va.preposition, va.isOptional
    FROM valency_frames vf
    LEFT JOIN valency_arguments va ON va.frameId = vf.id
    WHERE vf.meaningId = ?
    ORDER BY vf.sortOrder, vf.id, va.sortOrder, va.id
  `).all(meaningId)
  return JSON.stringify(rows)
}

/**
 * Reconciles a meaning's ValencyFrame/ValencyArgument rows against the
 * submitted form data (create/update/delete-by-diff, same pattern as
 * syncTranslationsForMeaning in lib/translations.ts). Rows with an invalid
 * `case` value are silently skipped rather than crashing the whole save.
 */
export function syncValencyFramesForMeaning(
  db: Database.Database,
  meaningId: number,
  frames: ValencyFrameInput[],
): FieldChange[] {
  const before = snapshot(db, meaningId)

  const existingFrames = db.prepare(`SELECT id FROM valency_frames WHERE meaningId = ?`).all(meaningId) as { id: number }[]
  const existingFrameIds = new Set(existingFrames.map((f) => f.id))
  const formFrameIds = new Set(frames.filter((f) => f.id > 0).map((f) => f.id))

  const framesToDelete = [...existingFrameIds].filter((id) => !formFrameIds.has(id))
  if (framesToDelete.length > 0) {
    const placeholders = framesToDelete.map(() => "?").join(",")
    db.prepare(`DELETE FROM valency_frames WHERE id IN (${placeholders})`).run(...framesToDelete)
  }

  const insertFrame = db.prepare(`INSERT INTO valency_frames (meaningId, label, sortOrder) VALUES (?, ?, ?)`)
  const updateFrame = db.prepare(`UPDATE valency_frames SET label = ?, sortOrder = ? WHERE id = ?`)
  const insertArg = db.prepare(`
    INSERT INTO valency_arguments (frameId, role, "case", preposition, isOptional, sortOrder)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const updateArg = db.prepare(`
    UPDATE valency_arguments SET role = ?, "case" = ?, preposition = ?, isOptional = ?, sortOrder = ? WHERE id = ?
  `)

  frames.forEach((frame, frameIdx) => {
    const label = frame.label?.trim() || null
    let frameId: number
    if (frame.id > 0 && existingFrameIds.has(frame.id)) {
      updateFrame.run(label, frameIdx, frame.id)
      frameId = frame.id
    } else {
      const result = insertFrame.run(meaningId, label, frameIdx)
      frameId = Number(result.lastInsertRowid)
    }

    const existingArgs = db.prepare(`SELECT id FROM valency_arguments WHERE frameId = ?`).all(frameId) as { id: number }[]
    const existingArgIds = new Set(existingArgs.map((a) => a.id))
    const formArgIds = new Set(frame.arguments.filter((a) => a.id > 0).map((a) => a.id))

    const argsToDelete = [...existingArgIds].filter((id) => !formArgIds.has(id))
    if (argsToDelete.length > 0) {
      const placeholders = argsToDelete.map(() => "?").join(",")
      db.prepare(`DELETE FROM valency_arguments WHERE id IN (${placeholders})`).run(...argsToDelete)
    }

    frame.arguments.forEach((arg, argIdx) => {
      if (!isValidCase(arg.case)) return
      const preposition = arg.preposition?.trim() || null
      const role = arg.role?.trim() || null
      const isOptional = arg.isOptional ? 1 : 0
      if (arg.id > 0 && existingArgIds.has(arg.id)) {
        updateArg.run(role, arg.case, preposition, isOptional, argIdx, arg.id)
      } else {
        insertArg.run(frameId, role, arg.case, preposition, isOptional, argIdx)
      }
    })
  })

  const after = snapshot(db, meaningId)
  if (before === after) return []
  return [{ field: `valencyFrame:${meaningId}`, oldValue: before, newValue: after }]
}
