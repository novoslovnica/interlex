// Омонимия корпуса на уровне лемм, а не пар «форма + граммема».
//
// CorpusToken.matchCount считает все совпавшие сгенерированные формы, поэтому
// растёт от каждого нового варианта парадигмы, даже если лемма у токена одна
// (по прежним замерам >99% «омонимичных» токенов — разные граммемы одного
// слова). Здесь считается число РАЗНЫХ лексем среди кандидатов токена.
//
// Только чтение. Пишет сводку в stdout (и в файл, если передан путь).
// Usage: npx tsx scripts/db/measure-corpus-ambiguity.ts [out.json]

import Database from "better-sqlite3"
import { writeFileSync } from "fs"
import path from "path"

const db = new Database(path.resolve(process.cwd(), "corpus.db"), { readonly: true })

const started = Date.now()

db.exec(`
    CREATE TEMP TABLE token_lemmas AS
    SELECT t.id AS tokenId, lower(t.surfaceForm) AS form, COUNT(DISTINCT c.wordSlug) AS lemmas
    FROM "CorpusToken" t
    JOIN "CorpusTokenCandidate" c ON c.tokenId = t.id
    WHERE t.wordIndex <> -1 AND t.matchCount > 0 AND t.isPartialMatch = 0
    GROUP BY t.id
`)

const buckets = db.prepare(`
    SELECT CASE WHEN lemmas <= 1 THEN '1' WHEN lemmas = 2 THEN '2' WHEN lemmas = 3 THEN '3' ELSE '4+' END AS lemmas,
           COUNT(*) AS tokens
    FROM token_lemmas GROUP BY 1 ORDER BY 1
`).all()

// Самые частотные формы с несколькими леммами — где неоднозначность реально
// бьёт по корпусу.
const topAmbiguous = db.prepare(`
    SELECT form, COUNT(*) AS tokens, MAX(lemmas) AS lemmas
    FROM token_lemmas WHERE lemmas >= 2
    GROUP BY form ORDER BY tokens DESC LIMIT 60
`).all()

const summary = { seconds: Math.round((Date.now() - started) / 1000), buckets, topAmbiguous }
console.log(JSON.stringify(summary, null, 1))
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(summary, null, 1))
db.close()
