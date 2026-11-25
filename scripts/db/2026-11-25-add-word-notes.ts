import Database from "better-sqlite3"

const db = new Database(process.env.AUTH_SQLITE_DB ?? "auth.db", { fileMustExist: true })
try {
    db.transaction(() => {
        db.exec(`
            CREATE TABLE IF NOT EXISTS "user_word_notes" (
                "userId" TEXT NOT NULL,
                "wordId" INTEGER NOT NULL,
                "body" TEXT NOT NULL,
                "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY ("userId", "wordId"),
                FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `)
    }).immediate()
} finally {
    db.close()
}
