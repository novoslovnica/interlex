// Corpus-local workflow state; compatible with the previous release.
import Database from "better-sqlite3"
import path from "node:path"
import { createWorkbenchAutomationSchema } from "../../lib/corpus/workbenchAutomationSchema"
const url = process.env.CORPUS_DATABASE_URL
const db = new Database(process.env.CORPUS_SQLITE_DB || (url?.startsWith("file:") ? url.slice(5) : path.resolve("corpus.db")), { fileMustExist: true })
try {
  db.transaction(() => createWorkbenchAutomationSchema(db)).immediate()
  console.log("Corpus editor assistance: tasks and indexed similar occurrences ready")
} finally { db.close() }
