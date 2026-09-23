import Database from "better-sqlite3"

// Настоящая SQLite в памяти, а не фейк: проверяется именно SQL (частичный
// уникальный индекс, пересчёт счётчиков в транзакции, сортировка пула).
// Колонки - подмножество боевой схемы, достаточное для этих запросов.
export function createDb(): Database.Database {
    const db = new Database(":memory:")
    db.exec(`
        CREATE TABLE lexemes (id INTEGER PRIMARY KEY, slug TEXT, value TEXT, pos TEXT, isPublic INTEGER NOT NULL DEFAULT 1, corpusFrequencyPerMln REAL);
        CREATE TABLE meanings (id INTEGER PRIMARY KEY, lexemeId INTEGER NOT NULL, meaning TEXT, examples TEXT);
        CREATE TABLE allophone_flavors (id INTEGER PRIMARY KEY, code TEXT);
        CREATE TABLE lexeme_allophones (id INTEGER PRIMARY KEY, lexemeId INTEGER, flavorId INTEGER, type TEXT, value TEXT);
        CREATE TABLE translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            language TEXT NOT NULL, value TEXT, verified INTEGER, message TEXT, meaningId INTEGER,
            communityStatus TEXT, communityYes REAL NOT NULL DEFAULT 0, communityNo REAL NOT NULL DEFAULT 0, communityResolvedAt DATETIME
        );
        CREATE TABLE translation_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, translationId INTEGER NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
            language TEXT NOT NULL, userId TEXT NOT NULL, verdict TEXT NOT NULL, suggestedValue TEXT, comment TEXT, valueSnapshot TEXT,
            weight REAL NOT NULL DEFAULT 1, isControl INTEGER NOT NULL DEFAULT 0, stale INTEGER NOT NULL DEFAULT 0,
            agreed INTEGER, controlExpected TEXT,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE contributor_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT NOT NULL, language TEXT NOT NULL,
            votesTotal INTEGER NOT NULL DEFAULT 0, votesResolved INTEGER NOT NULL DEFAULT 0, votesAgreed INTEGER NOT NULL DEFAULT 0,
            controlTotal INTEGER NOT NULL DEFAULT 0, controlCorrect INTEGER NOT NULL DEFAULT 0,
            accuracy REAL, weight REAL NOT NULL DEFAULT 1, flagged INTEGER NOT NULL DEFAULT 0,
            updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX contributor_stats_userId_language_key ON contributor_stats(userId, language);
        CREATE UNIQUE INDEX translation_votes_active_vote_key ON translation_votes(translationId, userId) WHERE stale = 0;
        CREATE TABLE audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT, actionId TEXT NOT NULL, entityType TEXT NOT NULL, entityId INTEGER NOT NULL,
            field TEXT NOT NULL, oldValue TEXT, newValue TEXT, userId TEXT, userEmail TEXT NOT NULL,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO allophone_flavors (id, code) VALUES (1, 'CORE');
        INSERT INTO lexemes (id, slug, value, pos, isPublic, corpusFrequencyPerMln) VALUES
            (1, 'voda-NOUN', 'voda', 'NOUN', 1, 900),
            (2, 'redky-ADJ', 'redky', 'ADJ', 1, 5),
            (3, 'skryty-ADJ', 'skryty', 'ADJ', 0, 5000),
            (4, 'bezpos', 'bezpos', NULL, 1, 5000),
            (5, 'novy-ADJ', 'novy', 'ADJ', 1, 300);
        INSERT INTO lexeme_allophones (lexemeId, flavorId, type, value) VALUES (1, 1, 'standard', 'voda');
        INSERT INTO meanings (id, lexemeId, meaning) VALUES (10, 1, 'H2O'), (20, 2, 'rare'), (30, 3, 'hidden'), (40, 4, 'no pos'), (50, 5, 'new');
        INSERT INTO translations (id, language, value, verified, meaningId) VALUES
            (100, 'pl', 'woda', 0, 10),
            (101, 'pl', 'rzadki', NULL, 20),
            (102, 'pl', 'ukryty', 0, 30),
            (103, 'pl', 'cokolwiek', 0, 40),
            (104, 'pl', '  ', 0, 20),
            (105, 'pl', 'sprawdzony', 1, 20),
            (106, 'ru', 'вода', 1, 10),
            (107, 'en', 'water', 0, 10),
            (108, 'pl', 'nowy', 1, 50);
    `)
    return db
}
