import Database from "better-sqlite3"
import fs from "fs"
import os from "os"
import path from "path"
import { describe, expect, it } from "vitest"
import { backupFileName, checkApply, checksumDrift, ensureRegistry, lastApplied, recordFinish, recordStart, rotateBackups } from "./registry"

function freshDb() {
    const db = new Database(":memory:")
    ensureRegistry(db)
    return db
}

function run(db: Database.Database, mode: "dry-run" | "apply" | "baseline", opts: { checksum?: string; exit?: number; at?: Date } = {}) {
    const id = recordStart(db, { name: "scripts/db/x.ts", kind: "data", checksum: opts.checksum ?? "a", gitCommit: null, mode }, opts.at)
    recordFinish(db, id, opts.exit ?? 0, opts.at)
}

const base = { name: "scripts/db/x.ts", checksum: "a", once: true, requiresDryRun: true, again: false }

describe("registry", () => {
    it("ensureRegistry is idempotent", () => {
        const db = freshDb()
        expect(() => ensureRegistry(db)).not.toThrow()
    })

    it("refuses --apply without a dry run", () => {
        const db = freshDb()
        expect(checkApply(db, base).ok).toBe(false)
    })

    it("refuses --apply after a failed dry run or a dry run of another version", () => {
        const db = freshDb()
        run(db, "dry-run", { exit: 1 })
        run(db, "dry-run", { checksum: "b" })
        expect(checkApply(db, base).ok).toBe(false)
    })

    it("allows --apply after a fresh successful dry run of the same version", () => {
        const db = freshDb()
        run(db, "dry-run")
        expect(checkApply(db, base)).toEqual({ ok: true })
    })

    it("refuses a dry run older than 24h", () => {
        const db = freshDb()
        run(db, "dry-run", { at: new Date("2026-09-20T10:00:00Z") })
        expect(checkApply(db, { ...base, now: new Date("2026-09-21T11:00:00Z") }).ok).toBe(false)
        expect(checkApply(db, { ...base, now: new Date("2026-09-21T09:00:00Z") }).ok).toBe(true)
    })

    it("refuses a second apply of a once-script unless --again", () => {
        const db = freshDb()
        run(db, "dry-run")
        run(db, "apply")
        expect(checkApply(db, base).ok).toBe(false)
        expect(checkApply(db, { ...base, again: true }).ok).toBe(true)
        expect(checkApply(db, { ...base, once: false }).ok).toBe(true)
    })

    it("a failed apply does not count as applied", () => {
        const db = freshDb()
        run(db, "apply", { exit: 1 })
        expect(lastApplied(db, base.name)).toBeUndefined()
    })

    it("baseline counts as applied but never reports checksum drift", () => {
        const db = freshDb()
        run(db, "baseline", { checksum: "old" })
        expect(lastApplied(db, base.name)?.mode).toBe("baseline")
        expect(checksumDrift(db, base.name, "new")).toBeUndefined()
        run(db, "apply", { checksum: "old" })
        expect(checksumDrift(db, base.name, "new")?.checksum).toBe("old")
        expect(checksumDrift(db, base.name, "old")).toBeUndefined()
    })

    it("rotateBackups keeps the newest ones and leaves other files alone", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-test-"))
        const dbPath = path.join(dir, "interlex.db")
        fs.writeFileSync(dbPath, "")
        fs.writeFileSync(path.join(dir, "interlex.db.backup-before-indexes"), "")
        const names = [1, 2, 3, 4].map((d) => backupFileName(dbPath, "scripts/db/x.ts", new Date(`2026-09-0${d}T00:00:00Z`)))
        for (const n of names) fs.writeFileSync(n, "")
        const removed = rotateBackups(dbPath, 2)
        expect(removed.map((r) => path.basename(r))).toEqual(names.slice(0, 2).map((n) => path.basename(n)))
        expect(fs.readdirSync(dir).sort()).toEqual(["interlex.db", "interlex.db.backup-before-indexes", ...names.slice(2).map((n) => path.basename(n))].sort())
        fs.rmSync(dir, { recursive: true })
    })
})
