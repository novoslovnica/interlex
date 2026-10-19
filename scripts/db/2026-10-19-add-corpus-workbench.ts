// Additive journal and version stamp; old code can still read and write tokens.
import Database from "better-sqlite3"
import path from "node:path"
import { createWorkbenchSchema } from "../../lib/corpus/workbenchSchema"
const url = process.env.CORPUS_DATABASE_URL
const db = new Database(process.env.CORPUS_SQLITE_DB || (url?.startsWith("file:") ? url.slice(5) : path.resolve("corpus.db")), { fileMustExist: true })
try {
  db.transaction(() => createWorkbenchSchema(db)).immediate()
  console.log("Corpus workbench journal and revision guards ready")
} finally { db.close() }
