// Выгружает с corpus.db ручные правки модераторов, которые затёрла бы замена
// файла снимком локальной пересборки (release.sh --db=corpus):
//   - токены с resolutionSource='manual' (выбранный омоним + граммемы);
//   - рёбра синтаксиса с source='manual';
//   - решения по кандидатам в словарь (CorpusCandidateProposal с reviewedByEmail -
//     автоматические статусы reconcile/clusterSignals адреса не пишут).
// Id токенов меняются при ретокенизации, поэтому токен описан стабильным ключом:
// документ + tokenIndex + surfaceForm, а на случай сдвига - текст предложения и
// номер вхождения этой формы в нём. Обратно правки кладёт corpus-import-manual.ts.
//
// Только чтение, скрипт самодостаточен (один better-sqlite3): release.sh
// копирует его на сервер до git pull, когда в серверной копии его может не быть.
//
// Usage:
//   npx tsx scripts/db/corpus-export-manual.ts [--out=corpus-manual-export.json]
//   npx tsx scripts/db/corpus-export-manual.ts --count     только счётчики, JSON в stdout
// База: CORPUS_SQLITE_DB или ./corpus.db.

import Database from "better-sqlite3"
import fs from "fs"
import path from "path"

export interface TokenKey {
    documentSlug: string
    tokenIndex: number
    surfaceForm: string
    sentenceText: string
    /** Сколько токенов с той же формой стоит в предложении раньше этого. */
    ordinal: number
}

export interface ManualToken extends TokenKey {
    wordSlug: string | null
    lemma: string
    pos: string
    feats: string | null
    candidate: { wordSlug: string; lemma: string; pos: string; feats: string | null; flavor: string | null; score: number } | null
}

export interface ManualDependency {
    dep: TokenKey
    head: TokenKey | null
    relation: string
    confidence: string
}

export interface ManualProposal {
    clusterKey: string
    ruleSource: string
    guessedPos: string
    guessedStemType: string
    guessedGrammeme: string
    guessedStem: string
    reconstructedForm: string
    siblingWordSlug: string | null
    possibleEndingGap: number
    rank: number
    occurrenceCount: number
    firstSeenAt: string
    lastSeenAt: string
    status: string
    resolutionNote: string | null
    candidateId: number | null
    reviewedByEmail: string
    reviewedAt: string | null
}

export interface ManualCounts { tokens: number; dependencies: number; proposals: number }

export interface ManualExport {
    exportedAt: string
    source: string
    counts: ManualCounts
    tokens: ManualToken[]
    dependencies: ManualDependency[]
    proposals: ManualProposal[]
}

export function countManual(db: Database.Database): ManualCounts {
    const n = (sql: string) => (db.prepare(sql).get() as { c: number }).c
    return {
        tokens: n(`SELECT COUNT(*) c FROM CorpusToken WHERE resolutionSource = 'manual'`),
        dependencies: n(`SELECT COUNT(*) c FROM CorpusDependency WHERE source = 'manual'`),
        proposals: n(`SELECT COUNT(*) c FROM CorpusCandidateProposal WHERE reviewedByEmail IS NOT NULL`),
    }
}

const KEY_COLUMNS = (alias: string) => `
    ${alias}.documentSlug AS ${alias}_documentSlug, ${alias}.tokenIndex AS ${alias}_tokenIndex, ${alias}.surfaceForm AS ${alias}_surfaceForm,
    (SELECT COUNT(*) FROM CorpusToken o WHERE o.sentenceId = ${alias}.sentenceId AND o.surfaceForm = ${alias}.surfaceForm AND o.tokenIndex < ${alias}.tokenIndex) AS ${alias}_ordinal`

type Row = Record<string, unknown>

function keyFrom(row: Row, alias: string, sentenceText: string): TokenKey {
    return {
        documentSlug: row[`${alias}_documentSlug`] as string,
        tokenIndex: row[`${alias}_tokenIndex`] as number,
        surfaceForm: row[`${alias}_surfaceForm`] as string,
        sentenceText,
        ordinal: row[`${alias}_ordinal`] as number,
    }
}

export function exportManual(db: Database.Database, source: string): ManualExport {
    const chosen = db.prepare(`
        SELECT wordSlug, lemma, pos, feats, flavor, score FROM CorpusTokenCandidate
        WHERE tokenId = ? AND source = 'manual' ORDER BY rank LIMIT 1
    `)
    const tokens = (db.prepare(`
        SELECT t.id, t.wordSlug, t.lemma, t.pos, t.feats, s.rawText AS sentenceText, ${KEY_COLUMNS("t")}
        FROM CorpusToken t JOIN CorpusSentence s ON s.id = t.sentenceId
        WHERE t.resolutionSource = 'manual'
    `).all() as Row[]).map((r): ManualToken => ({
        ...keyFrom(r, "t", r.sentenceText as string),
        wordSlug: r.wordSlug as string | null,
        lemma: r.lemma as string,
        pos: r.pos as string,
        feats: r.feats as string | null,
        candidate: (chosen.get(r.id) as ManualToken["candidate"]) ?? null,
    }))

    const dependencies = (db.prepare(`
        SELECT d.relation, d.confidence, s.rawText AS sentenceText, d.headTokenId,
               ${KEY_COLUMNS("dt")}, ${KEY_COLUMNS("ht")}
        FROM CorpusDependency d
        JOIN CorpusToken dt ON dt.id = d.depTokenId
        LEFT JOIN CorpusToken ht ON ht.id = d.headTokenId
        JOIN CorpusSentence s ON s.id = d.sentenceId
        WHERE d.source = 'manual'
    `).all() as Row[]).map((r): ManualDependency => ({
        dep: keyFrom(r, "dt", r.sentenceText as string),
        head: r.headTokenId === null ? null : keyFrom(r, "ht", r.sentenceText as string),
        relation: r.relation as string,
        confidence: r.confidence as string,
    }))

    const proposals = db.prepare(`
        SELECT clusterKey, ruleSource, guessedPos, guessedStemType, guessedGrammeme, guessedStem, reconstructedForm,
               siblingWordSlug, possibleEndingGap, rank, occurrenceCount, firstSeenAt, lastSeenAt,
               status, resolutionNote, candidateId, reviewedByEmail, reviewedAt
        FROM CorpusCandidateProposal WHERE reviewedByEmail IS NOT NULL
    `).all() as ManualProposal[]

    return {
        exportedAt: new Date().toISOString(),
        source,
        counts: { tokens: tokens.length, dependencies: dependencies.length, proposals: proposals.length },
        tokens,
        dependencies,
        proposals,
    }
}

function main() {
    const dbPath = process.env.CORPUS_SQLITE_DB || path.resolve(process.cwd(), "corpus.db")
    const db = new Database(dbPath, { readonly: true, fileMustExist: true })
    if (process.argv.includes("--count")) {
        console.log(JSON.stringify(countManual(db)))
        return
    }
    const out = process.argv.find((a) => a.startsWith("--out="))?.slice("--out=".length) ?? "corpus-manual-export.json"
    const data = exportManual(db, dbPath)
    fs.writeFileSync(out, JSON.stringify(data))
    console.log(`${dbPath} -> ${out}: ${data.counts.tokens} tokens, ${data.counts.dependencies} dependencies, ${data.counts.proposals} proposal decisions`)
}

// Импортируется из corpus-import-manual.ts ради типов и exportManual (тесты) - main только при прямом запуске.
if (process.argv[1]?.includes("corpus-export-manual")) main()
