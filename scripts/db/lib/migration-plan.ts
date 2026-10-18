import Database from "better-sqlite3"
import fs from "node:fs"
import path from "node:path"
import { DB_FILES, schemaMigrations, type ManifestEntry } from "../manifest"
import { fileChecksum, lastApplied } from "./registry"

/** Planning must not create databases/registries or hide changed applied scripts. */
export function pendingSchema(root: string, dbDir: string): ManifestEntry[] {
    const pending = schemaMigrations().filter((entry) => {
        const filename = path.join(dbDir, DB_FILES[entry.db])
        if (!fs.existsSync(filename)) throw new Error(`${filename} missing`)
        const db = new Database(filename, { readonly: true, fileMustExist: true })
        try {
            if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name = '_applied_scripts'").get()) return true
            const applied = lastApplied(db, entry.path)
            if (!applied) return true
            if (applied.checksum !== fileChecksum(path.join(root, entry.path))) {
                throw new Error(`applied schema script changed: ${entry.path}; add a new migration`)
            }
            return false
        } finally { db.close() }
    })
    for (const entry of pending) {
        if (!entry.rollbackSafe) throw new Error(`schema must explicitly support code rollback: ${entry.path}`)
    }
    return pending
}
