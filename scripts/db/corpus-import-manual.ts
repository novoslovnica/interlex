// Кладёт ручные правки модераторов, выгруженные с прода corpus-export-manual.ts,
// в локальный снимок corpus.db перед его выкладкой (release.sh --db=corpus).
// Токен ищется по (документ, tokenIndex, surfaceForm); если текст сдвинулся -
// по тексту предложения и номеру вхождения формы в нём. Не найденные правки
// перечисляются, и при их наличии скрипт завершается с ошибкой: выкладка не
// должна молча терять работу модераторов (--allow-missing - осознанно смириться).
//
// Идемпотентен. Dry run по умолчанию (всё в транзакции, которая откатывается).
//
// Usage:
//   npx tsx scripts/db/corpus-import-manual.ts <export.json> [--db=corpus-release.db] [--apply] [--allow-missing]

import Database from "better-sqlite3"
import fs from "fs"
import path from "path"
import type { ManualExport, TokenKey } from "./corpus-export-manual"

export interface ImportReport {
    tokens: { byIndex: number; bySentence: number; missing: TokenKey[] }
    dependencies: { applied: number; missing: TokenKey[] }
    proposals: { updated: number; inserted: number }
}

function sameFeats(a: string | null, b: string | null): boolean {
    const norm = (v: string | null) => {
        if (v === null || v === "") return "{}"
        try {
            const o = JSON.parse(v) as Record<string, unknown>
            return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]))
        } catch { return v }
    }
    return norm(a) === norm(b)
}

export function importManual(db: Database.Database, data: ManualExport): ImportReport {
    const report: ImportReport = { tokens: { byIndex: 0, bySentence: 0, missing: [] }, dependencies: { applied: 0, missing: [] }, proposals: { updated: 0, inserted: 0 } }

    const byIndex = db.prepare(`SELECT id, surfaceForm FROM CorpusToken WHERE documentSlug = ? AND tokenIndex = ?`)
    const sentences = db.prepare(`SELECT id FROM CorpusSentence WHERE documentSlug = ? AND rawText = ?`)
    const inSentence = db.prepare(`SELECT id FROM CorpusToken WHERE sentenceId = ? AND surfaceForm = ? ORDER BY tokenIndex`)
    const sentenceOf = db.prepare(`SELECT sentenceId FROM CorpusToken WHERE id = ?`)

    function locate(key: TokenKey): { id: number | bigint; how: "index" | "sentence" } | null {
        const hit = byIndex.get(key.documentSlug, key.tokenIndex) as { id: number; surfaceForm: string } | undefined
        if (hit && hit.surfaceForm === key.surfaceForm) return { id: hit.id, how: "index" }
        // Текст документа мог измениться выше по тексту - ищем то же предложение.
        const found = (sentences.all(key.documentSlug, key.sentenceText) as { id: string }[])
            .map((s) => (inSentence.all(s.id, key.surfaceForm) as { id: number }[])[key.ordinal])
            .filter((t): t is { id: number } => !!t)
        return found.length === 1 ? { id: found[0].id, how: "sentence" } : null
    }

    const updateToken = db.prepare(`
        UPDATE CorpusToken SET wordSlug = ?, lemma = ?, pos = ?, feats = ?, matchCount = 1, resolutionSource = 'manual' WHERE id = ?
    `)
    const candidates = db.prepare(`SELECT id, wordSlug, feats FROM CorpusTokenCandidate WHERE tokenId = ? ORDER BY rank, id`)
    const setCandidate = db.prepare(`UPDATE CorpusTokenCandidate SET rank = ?, source = CASE WHEN ? THEN 'manual' ELSE source END WHERE id = ?`)
    const insertCandidate = db.prepare(`
        INSERT INTO CorpusTokenCandidate (tokenId, wordSlug, lemma, pos, feats, flavor, score, source, rank) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', 0)
    `)

    for (const t of data.tokens) {
        const loc = locate(t)
        if (!loc) { report.tokens.missing.push(t); continue }
        if (loc.how === "index") report.tokens.byIndex++; else report.tokens.bySentence++
        updateToken.run(t.wordSlug, t.lemma, t.pos, t.feats, loc.id)
        // Как resolveTokenHomonym: выбранный кандидат - rank 0 и source='manual', остальные не удаляются.
        const chosenSlug = t.candidate?.wordSlug ?? t.wordSlug
        const chosenFeats = t.candidate?.feats ?? t.feats
        const list = candidates.all(loc.id) as { id: number; wordSlug: string; feats: string | null }[]
        const match = list.find((c) => c.wordSlug === chosenSlug && sameFeats(c.feats, chosenFeats))
        let rank = 1
        for (const c of list) {
            if (c === match) continue
            setCandidate.run(rank++, 0, c.id)
        }
        if (match) setCandidate.run(0, 1, match.id)
        else if (chosenSlug) {
            const c = t.candidate
            insertCandidate.run(loc.id, chosenSlug, c?.lemma ?? t.lemma, c?.pos ?? t.pos, chosenFeats, c?.flavor ?? null, c?.score ?? 0)
        }
    }

    const upsertDep = db.prepare(`
        INSERT INTO CorpusDependency (sentenceId, headTokenId, depTokenId, relation, confidence, source)
        VALUES (?, ?, ?, ?, ?, 'manual')
        ON CONFLICT(depTokenId) DO UPDATE SET sentenceId = excluded.sentenceId, headTokenId = excluded.headTokenId,
            relation = excluded.relation, confidence = excluded.confidence, source = 'manual'
    `)
    for (const d of data.dependencies) {
        const dep = locate(d.dep)
        const head = d.head ? locate(d.head) : null
        if (!dep || (d.head && !head)) { report.dependencies.missing.push(dep ? d.head! : d.dep); continue }
        const { sentenceId } = sentenceOf.get(dep.id) as { sentenceId: string }
        upsertDep.run(sentenceId, head?.id ?? null, dep.id, d.relation, d.confidence)
        report.dependencies.applied++
    }

    const updateProposal = db.prepare(`
        UPDATE CorpusCandidateProposal SET status = ?, resolutionNote = ?, candidateId = ?, reviewedByEmail = ?, reviewedAt = ?
        WHERE clusterKey = ? AND ruleSource = ? AND guessedStemType = ? AND guessedGrammeme = ?
    `)
    // Гипотезы, которой в пересобранном корпусе нет, решение модератора всё равно
    // должно пережить (иначе следующий прогон предложит её снова как новую).
    const insertProposal = db.prepare(`
        INSERT INTO CorpusCandidateProposal (clusterKey, ruleSource, guessedPos, guessedStemType, guessedGrammeme, guessedStem, reconstructedForm,
            siblingWordSlug, possibleEndingGap, rank, occurrenceCount, exampleTokenIds, firstSeenAt, lastSeenAt,
            status, resolutionNote, candidateId, reviewedByEmail, reviewedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const p of data.proposals) {
        const res = updateProposal.run(p.status, p.resolutionNote, p.candidateId, p.reviewedByEmail, p.reviewedAt, p.clusterKey, p.ruleSource, p.guessedStemType, p.guessedGrammeme)
        if (res.changes > 0) { report.proposals.updated++; continue }
        insertProposal.run(p.clusterKey, p.ruleSource, p.guessedPos, p.guessedStemType, p.guessedGrammeme, p.guessedStem, p.reconstructedForm,
            p.siblingWordSlug, p.possibleEndingGap, p.rank, p.occurrenceCount, p.firstSeenAt, p.lastSeenAt,
            p.status, p.resolutionNote, p.candidateId, p.reviewedByEmail, p.reviewedAt)
        report.proposals.inserted++
    }
    return report
}

class DryRun extends Error {}

function main() {
    const args = process.argv.slice(2)
    const file = args.find((a) => !a.startsWith("--"))
    if (!file) throw new Error("usage: corpus-import-manual.ts <export.json> [--db=path] [--apply] [--allow-missing]")
    const apply = args.includes("--apply")
    const dbPath = args.find((a) => a.startsWith("--db="))?.slice(5) ?? process.env.CORPUS_SQLITE_DB ?? path.resolve(process.cwd(), "corpus.db")
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as ManualExport
    const db = new Database(dbPath, { fileMustExist: true })
    console.log(`${file} (exported ${data.exportedAt}: ${data.counts.tokens} tokens, ${data.counts.dependencies} dependencies, ${data.counts.proposals} proposals) -> ${dbPath}`)

    const allowMissing = args.includes("--allow-missing")
    let report: ImportReport | undefined
    let written = false
    try {
        db.transaction(() => {
            report = importManual(db, data)
            const lost = report.tokens.missing.length + report.dependencies.missing.length
            if (!apply || (lost > 0 && !allowMissing)) throw new DryRun()
        })()
        written = true
    } catch (e) {
        if (!(e instanceof DryRun)) throw e
    }
    const r = report!
    console.log(`tokens: ${r.tokens.byIndex} by position, ${r.tokens.bySentence} by sentence text, ${r.tokens.missing.length} not found`)
    console.log(`dependencies: ${r.dependencies.applied} applied, ${r.dependencies.missing.length} not found`)
    console.log(`proposal decisions: ${r.proposals.updated} updated, ${r.proposals.inserted} inserted`)
    const missing = [...r.tokens.missing, ...r.dependencies.missing]
    for (const m of missing.slice(0, 20)) console.log(`  not found: ${m.documentSlug} #${m.tokenIndex} "${m.surfaceForm}" in "${m.sentenceText.slice(0, 80)}"`)
    if (missing.length > 20) console.log(`  ... and ${missing.length - 20} more`)
    console.log(written ? "applied" : apply ? "nothing written" : "dry run - nothing written; re-run with --apply")
    db.close()
    if (missing.length > 0 && !allowMissing) {
        console.error(`\n${missing.length} manual edits have no place in this corpus (document text changed?). Fix the documents or re-run with --allow-missing to drop them knowingly.`)
        process.exit(3)
    }
}

if (process.argv[1]?.includes("corpus-import-manual")) main()
