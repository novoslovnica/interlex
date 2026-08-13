import Database from "better-sqlite3"

// Raw better-sqlite3 connection to corpus.db, mirroring lib/sqlite.ts's
// init() for interlex.db. Needed because CqlTranslator (lib/cql/) emits raw
// parameterized SQL against CorpusToken directly - there's no Prisma model
// shape that fits an arbitrary N-segment self-join. CORPUS_SQLITE_DB isn't
// actually set anywhere in .env (only CORPUS_DATABASE_URL, which is Prisma's
// own "file:./corpus.db" connection string, a different format) - the
// fallback to cwd-relative "corpus.db" is what every corpus migration
// script and lib/corpus/syntax/government.ts already rely on.
export function initCorpusDb(): Database.Database {
    const dbPath = process.env.CORPUS_SQLITE_DB || "corpus.db"
    return new Database(dbPath)
}
