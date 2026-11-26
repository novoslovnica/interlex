import { createHash, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import Database from "better-sqlite3"
import { normalizeSurfaceForm } from "@/lib/corpus/surfaceForm"
import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"
import { expandVariants } from "@/lib/corpus/tokenizer/lexemeVariants"

interface Occurrence {
    id: string
    form: string
    sentence: string
    doc: string
    hash: string
}

interface Draft {
    value: string
    pos: "NOUN" | "ADJ" | "VERB"
    properNoun: boolean
    evidence: Occurrence[]
}

interface Spelling {
    value: string | null
    pos: string | null
}

const actor = "script:stage-corpus-drafts-2026-11-26"
const apply = process.argv.includes("--apply")
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const bytes = readFileSync(resolve("data/corpus-candidate-review/2026-11-26-drafts.json"))
if (hash(bytes) !== "9c15cd4f58ca3b29d7151db74365c09172523e78648f35a60bec73b3ab1e0b95") {
    throw new Error("Изменился файл проверенных черновиков")
}
const drafts: Draft[] = JSON.parse(bytes.toString("utf8"))
const spellingKey = (pos: string, value: string) => `${pos.toUpperCase()}:${foldDiacritics(normalizeSurfaceForm(value))}`
const dictionary = new Database(process.env.SQLITE_DB ?? resolve("interlex.db"), {
    readonly: !apply, fileMustExist: true, timeout: 10_000,
})
const corpus = new Database(process.env.CORPUS_SQLITE_DB ?? resolve("corpus.db"), {
    readonly: true, fileMustExist: true, timeout: 10_000,
})

function verifiedDrafts() {
    const token = corpus.prepare<[bigint], { form: string; doc: string; sentence: string; context: string }>(`
        SELECT t.surfaceForm AS form, t.documentSlug AS doc, t.sentenceId AS sentence, s.rawText AS context
        FROM CorpusToken t JOIN CorpusSentence s ON s.id = t.sentenceId
        WHERE t.id = ? AND t.wordIndex <> -1
    `)
    return drafts.filter(draft => {
        const valid = draft.evidence.length > 0 && draft.evidence.every(example => {
            const found = token.get(BigInt(example.id))
            return found?.form === example.form && found.doc === example.doc &&
                found.sentence === example.sentence && hash(found.context) === example.hash
        })
        if (!valid) console.log(JSON.stringify({ skipped: draft.value, reason: "Корпусный контекст изменился" }))
        return valid
    })
}

function stage(verified: Draft[]) {
    const knownRows = dictionary.prepare<[], Spelling>(`
        SELECT value, pos FROM lexemes
        UNION SELECT a.value, l.pos FROM lexeme_allophones a JOIN lexemes l ON l.id = a.lexemeId
        UNION SELECT value, pos FROM candidates WHERE promotedAt IS NULL
        UNION SELECT isv AS value, pos FROM candidates WHERE promotedAt IS NULL
    `)
    const known = new Set<string>()
    for (const { value, pos } of knownRows.iterate()) {
        if (!pos) continue
        for (const variant of expandVariants(value)) known.add(spellingKey(pos, variant))
    }
    const insert = dictionary.prepare(`
        INSERT INTO candidates (value, pos, properNoun, updatedAt) VALUES (?, ?, ?, ?)
    `)
    const audit = dictionary.prepare(`
        INSERT INTO audit_logs (actionId, entityType, entityId, field, newValue, userEmail, createdAt)
        VALUES (?, 'Candidate', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    const now = new Date().toISOString()
    const counts = { staged: 0, existing: 0, stale: drafts.length - verified.length }
    for (const draft of verified) {
        const key = spellingKey(draft.pos, draft.value)
        if (known.has(key)) {
            counts.existing++
            console.log(JSON.stringify({ existing: draft.value, pos: draft.pos }))
            continue
        }
        known.add(key)
        counts.staged++
        console.log(JSON.stringify({ stage: draft.value, pos: draft.pos, properNoun: draft.properNoun }))
        if (!apply) continue
        const id = insert.run(draft.value, draft.pos, Number(draft.properNoun), now).lastInsertRowid
        const actionId = randomUUID()
        audit.run(actionId, id, "value", draft.value, actor)
        audit.run(actionId, id, "pos", draft.pos, actor)
        if (draft.properNoun) audit.run(actionId, id, "properNoun", "true", actor)
        audit.run(actionId, id, "corpusEvidence", JSON.stringify(draft.evidence), actor)
    }
    return counts
}

try {
    const verified = corpus.transaction(verifiedDrafts)()
    const transaction = dictionary.transaction(() => stage(verified))
    const counts = apply ? transaction.immediate() : transaction()
    console.log(JSON.stringify({ apply, ...counts }))
} finally {
    corpus.close()
    dictionary.close()
}
