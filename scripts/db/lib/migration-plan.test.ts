import { afterEach, expect, it } from "vitest"
import Database from "better-sqlite3"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pendingSchema } from "./migration-plan"
import { DB_FILES, schemaMigrations } from "../manifest"
import { ensureRegistry, fileChecksum, recordStart, recordFinish } from "./registry"
const temps: string[] = []
afterEach(() => { for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })
function setup(applied: boolean) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "interlex-migration-plan-")); temps.push(dir)
    for (const entry of schemaMigrations()) {
        const db = new Database(path.join(dir, DB_FILES[entry.db]))
        if (applied) {
            ensureRegistry(db)
            const id = recordStart(db, { name: entry.path, kind: "schema", checksum: fileChecksum(entry.path), gitCommit: null, mode: "apply" })
            recordFinish(db, id, 0)
        }
        db.close()
    }
    return dir
}
it("plans unregistered migrations without creating a registry", () => {
    const dir = setup(false)
    expect(pendingSchema(process.cwd(), dir)).toEqual(schemaMigrations())
    const db = new Database(path.join(dir, "auth.db"), { readonly: true })
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = '_applied_scripts'").get()).toBeUndefined()
    db.close()
})
it("skips applied schemas but refuses checksum drift", () => {
    const dir = setup(true)
    expect(pendingSchema(process.cwd(), dir)).toEqual([])
    const db = new Database(path.join(dir, "auth.db"))
    db.exec("UPDATE _applied_scripts SET checksum='changed'"); db.close()
    expect(() => pendingSchema(process.cwd(), dir)).toThrow("applied schema script changed")
})
it("refuses missing databases without creating an empty SQLite file", () => {
    const dir = setup(false), filename = path.join(dir, "auth.db")
    fs.rmSync(filename)
    expect(() => pendingSchema(process.cwd(), dir)).toThrow("missing")
    expect(fs.existsSync(filename)).toBe(false)
})

it("requires an explicit rollback compatibility declaration for pending schemas", () => {
    const dir = setup(false), entry = schemaMigrations()[0]
    const original = entry.rollbackSafe
    try {
        entry.rollbackSafe = false
        expect(() => pendingSchema(process.cwd(), dir)).toThrow("explicitly support code rollback")
    } finally { entry.rollbackSafe = original }
})
