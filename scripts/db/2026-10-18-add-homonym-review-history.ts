// Idempotent schema migration; no corpus scan and no token rewrite.
import Database from "better-sqlite3"
import path from "node:path"
import { createHomonymReviewSchema } from "../../lib/corpus/homonymReviewSchema"

const url = process.env.CORPUS_DATABASE_URL
const dbPath = process.env.CORPUS_SQLITE_DB || (url?.startsWith("file:") ? url.slice(5) : path.resolve("corpus.db"))
const db = new Database(dbPath, { fileMustExist: true })
try {
  db.transaction(() => createHomonymReviewSchema(db)).immediate()
  console.log("Homonym review history and conflict guards ready")
} finally {
  db.close()
}
