import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import Database from "better-sqlite3"
import { normalizeSurfaceForm } from "@/lib/corpus/surfaceForm"

interface Occurrence {
    id: string
    form: string
    sentence: string
    doc: string
    hash: string
}

interface Decision {
    key: string
    hypotheses: string
    occurrences: Occurrence[]
    target: { id: number; slug: string; meanings: (string | null)[] } | null
    draft?: { value: string; pos: string; properNoun: boolean }
    reason: string
}

interface Token {
    sentenceId: string
    documentSlug: string
    matchCount: bigint
    isPartialMatch: bigint
    wordSlug: string | null
    resolutionSource: string | null
}

interface Hypothesis {
    id: number
    status: string
    ruleSource: string
    guessedPos: string
    guessedStemType: string
    guessedGrammeme: string
    guessedStem: string
    reconstructedForm: string
    candidateId: number | null
    resolutionNote: string | null
    reviewedAt: string | null
    reviewedByEmail: string | null
}

const actor = "script:review-corpus-wordforms-2026-11-26-02"
const apply = process.argv.includes("--apply")
const hash = (text: string | Buffer) => createHash("sha256").update(text).digest("hex")
const planBytes = readFileSync(resolve("data/corpus-candidate-review/2026-11-26-02.json"))
const planChecksum = "339fc5c689ea593450c4146e69856517c83c68c048f047ed90f9575e11740d9e"
if (hash(planBytes) !== planChecksum) throw new Error("Изменился файл проверенных решений")
const decisions: Decision[] = JSON.parse(planBytes.toString("utf8"))
const byKey = new Map(decisions.map((decision) => [decision.key, decision]))
if (byKey.size !== decisions.length) throw new Error("В списке повторяются группы")
if (decisions.some(({ target, draft }) => target && draft)) throw new Error("У решения две цели")

const dictionary = new Database(process.env.SQLITE_DB ?? resolve("interlex.db"), {
    readonly: true, fileMustExist: true, timeout: 10_000,
})
const corpus = new Database(process.env.CORPUS_SQLITE_DB ?? resolve("corpus.db"), {
    readonly: !apply, fileMustExist: true, timeout: 10_000,
})
const tokens = corpus.prepare<[], { id: bigint; surfaceForm: string }>(
    "SELECT id, surfaceForm FROM CorpusToken WHERE wordIndex <> -1 ORDER BY id",
).safeIntegers()
const tokenDetails = corpus.prepare<[bigint], Token>(`
    SELECT sentenceId, documentSlug, matchCount, isPartialMatch, wordSlug, resolutionSource
    FROM CorpusToken WHERE id = ?
`).safeIntegers()
const sentence = corpus.prepare<[string], { rawText: string }>("SELECT rawText FROM CorpusSentence WHERE id = ?")
const hypotheses = corpus.prepare<[string], Hypothesis>(`
    SELECT id, status, ruleSource, guessedPos, guessedStemType, guessedGrammeme, guessedStem,
        reconstructedForm, candidateId, resolutionNote, reviewedAt, reviewedByEmail
    FROM CorpusCandidateProposal WHERE clusterKey = ? ORDER BY id
`)
const lexeme = dictionary.prepare<[number], { slug: string; isPublic: number }>(
    "SELECT slug, isPublic FROM lexemes WHERE id = ?",
)
const meanings = dictionary.prepare<[number], { meaning: string | null }>(
    "SELECT meaning FROM meanings WHERE lexemeId = ? ORDER BY id",
)
const pendingDrafts = dictionary.prepare<[string, string, number], { id: number }>(`
    SELECT id FROM candidates
    WHERE value = ? AND upper(pos) = ? AND properNoun = ? AND promotedAt IS NULL
`)
const spellings = dictionary.prepare<[], { value: string }>(`
    SELECT value FROM lexemes WHERE value IS NOT NULL
    UNION SELECT value FROM lexeme_allophones WHERE value IS NOT NULL
    UNION SELECT value FROM candidates WHERE promotedAt IS NULL AND value IS NOT NULL
    UNION SELECT isv AS value FROM candidates WHERE promotedAt IS NULL AND isv IS NOT NULL
`)
const update = corpus.prepare(`
    UPDATE CorpusCandidateProposal SET status = ?, candidateId = ?, resolutionNote = ?, reviewedAt = ?, reviewedByEmail = ?
    WHERE id = ? AND status IN ('pending', 'deferred') AND candidateId IS NULL
        AND reviewedAt IS NULL AND reviewedByEmail IS NULL
`)

function observedOccurrences() {
    const hits = new Map<string, Occurrence[]>()
    const conflicts = new Set<string>()
    for (const token of tokens.iterate()) {
        const key = normalizeSurfaceForm(token.surfaceForm)
        const decision = byKey.get(key)
        if (!decision || conflicts.has(key)) continue
        const details = tokenDetails.get(token.id)
        const context = details && sentence.get(details.sentenceId)
        if (!details || !context?.rawText || details.resolutionSource === "manual" || details.matchCount > 1n ||
            (details.matchCount === 1n && details.isPartialMatch === 0n && details.wordSlug !== decision.target?.slug)) {
            conflicts.add(key)
            continue
        }
        const occurrences = hits.get(key) ?? []
        occurrences.push({
            id: token.id.toString(), form: token.surfaceForm, sentence: details.sentenceId,
            doc: details.documentSlug, hash: hash(context.rawText),
        })
        hits.set(key, occurrences)
    }
    return { hits, conflicts }
}

function review() {
    const { hits, conflicts } = observedOccurrences()
    const protectedKeys = new Set<string>()
    for (const { value } of spellings.iterate()) {
        for (const variant of value.split(/[,;]/u)) protectedKeys.add(normalizeSurfaceForm(variant))
    }
    const now = new Date().toISOString()
    const counts = { linked: 0, draftsLinked: 0, rejected: 0, skipped: 0, alreadyApplied: 0 }
    const updates: { status: string; draftId: number | null; headId?: number; note: string; rows: Hypothesis[] }[] = []
    for (const decision of decisions) {
        const rows = hypotheses.all(decision.key)
        const { target, draft } = decision
        const draftMatches = draft ? pendingDrafts.all(draft.value, draft.pos, Number(draft.properNoun)) : []
        const draftId = draftMatches.length === 1 ? draftMatches[0].id : null
        const status = target || draft ? "merged_into_existing" : "rejected"
        // Keep previous automatic recognitions when resolving the still-open hypotheses for a draft.
        const activeRows = draft ? rows.filter((row) => row.status !== "resolved_recognized") : rows
        if (activeRows.length > 0 && activeRows.every((row) =>
            row.reviewedByEmail === actor && row.candidateId === draftId &&
            (row.status === status || (draftId !== null && row.status === "promoted")),
        )) {
            counts.alreadyApplied++
            continue
        }
        const entry = target && lexeme.get(target.id)
        const dictionaryMismatch = target
            ? !entry?.isPublic || entry.slug !== target.slug ||
                JSON.stringify(meanings.all(target.id).map((row) => row.meaning)) !== JSON.stringify(target.meanings)
            : draft ? draftId === null : protectedKeys.has(decision.key)
        const queueMismatch = hash(JSON.stringify(rows)) !== decision.hypotheses || activeRows.length === 0 ||
            activeRows.some((row) => !["pending", "deferred"].includes(row.status) ||
                row.ruleSource === "editor_workbench" || row.candidateId !== null ||
                row.reviewedAt !== null || row.reviewedByEmail !== null)
        const occurrences = hits.get(decision.key)
        const corpusMismatch = conflicts.has(decision.key) ||
            JSON.stringify(occurrences) !== JSON.stringify(decision.occurrences)
        if (dictionaryMismatch || queueMismatch || corpusMismatch || !occurrences?.length) {
            counts.skipped++
            console.log(JSON.stringify({ skipped: decision.key, dictionaryMismatch, queueMismatch, corpusMismatch }))
            continue
        }
        const example = occurrences[0]
        const reference = target ? ` Словарная статья /words/${target.id}.` :
            draft ? ` Черновик №${draftId} «${draft.value}».` : ""
        const note = `${decision.reason}${reference} Вхождений: ${occurrences.length}. Пример: ${example.doc}, токен ${example.id}.`
        const head = draft && decision.key === normalizeSurfaceForm(draft.value)
            ? activeRows.find((row) => row.guessedPos === draft.pos && row.reconstructedForm === draft.value)
            : undefined
        updates.push({ status, draftId, headId: head?.id, note, rows: activeRows })
        counts[target ? "linked" : draft ? "draftsLinked" : "rejected"]++
        console.log(JSON.stringify({ key: decision.key, status, note, ...(apply ? { before: activeRows, draftId } : {}) }))
    }
    if (apply) {
        for (const { status, draftId, headId, note, rows } of updates) {
            for (const row of rows) {
                const nextStatus = row.id === headId ? "promoted" : status
                if (update.run(nextStatus, draftId, note, now, actor, row.id).changes !== 1) {
                    throw new Error(`Изменилась гипотеза №${row.id}`)
                }
            }
        }
    }
    return counts
}

try {
    const counts = corpus.transaction(review)()
    console.log(JSON.stringify({ apply, ...counts }))
} finally {
    corpus.close()
    dictionary.close()
}
