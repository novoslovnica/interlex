import Database from "better-sqlite3"
import { describe, expect, it } from "vitest"
import { countManual, exportManual } from "./corpus-export-manual"
import { importManual } from "./corpus-import-manual"
import { CORPUS_TEST_SCHEMA } from "./lib/corpusTestSchema"

// Схема - копия настоящей corpus.db (sqlite3 .schema), без индексов, кроме уникальных.

type Tok = [id: number, sentence: string, tokenIndex: number, surface: string]

function corpus(sentences: Record<string, string>, tokens: Tok[]) {
    const db = new Database(":memory:")
    db.exec(CORPUS_TEST_SCHEMA)
    db.prepare(`INSERT INTO CorpusDocument (id, slug, title, rawText, updatedAt) VALUES ('d', 'doc', 't', '', '2026-09-24')`).run()
    db.prepare(`INSERT INTO CorpusSegment (id, documentSlug, position, rawText) VALUES ('seg', 'doc', 0, '')`).run()
    let pos = 0
    for (const [id, text] of Object.entries(sentences)) db.prepare(`INSERT INTO CorpusSentence (id, documentSlug, segmentId, position, rawText) VALUES (?, 'doc', 'seg', ?, ?)`).run(id, pos++, text)
    for (const [id, s, idx, surface] of tokens) {
        db.prepare(`INSERT INTO CorpusToken (id, documentSlug, sentenceId, tokenIndex, wordIndex, surfaceForm, lemma, pos) VALUES (?, 'doc', ?, ?, ?, ?, ?, 'X')`).run(id, s, idx, idx, surface, surface)
        db.prepare(`INSERT INTO CorpusTokenCandidate (tokenId, wordSlug, lemma, pos, feats, rank) VALUES (?, ?, ?, 'NOUN', '{"case":"nom"}', 0)`).run(id, `${surface}-NOUN`, surface)
        db.prepare(`INSERT INTO CorpusTokenCandidate (tokenId, wordSlug, lemma, pos, feats, rank) VALUES (?, ?, ?, 'VERB', NULL, 1)`).run(id, `${surface}-VERB`, surface)
    }
    return db
}

function prodCorpus() {
    const db = corpus({ s1: "Ja vidžu dom.", s2: "Dom je velik dom." }, [
        [1, "s1", 0, "Ja"], [2, "s1", 1, "vidžu"], [3, "s1", 2, "dom"],
        [4, "s2", 3, "Dom"], [5, "s2", 4, "je"], [6, "s2", 5, "velik"], [7, "s2", 6, "dom"],
    ])
    // Модератор выбрал VERB-кандидата у второго "dom" во втором предложении...
    db.prepare(`UPDATE CorpusToken SET wordSlug = 'dom-VERB', lemma = 'dom', pos = 'VERB', feats = NULL, resolutionSource = 'manual' WHERE id = 7`).run()
    db.prepare(`UPDATE CorpusTokenCandidate SET rank = 0, source = 'manual' WHERE tokenId = 7 AND wordSlug = 'dom-VERB'`).run()
    db.prepare(`UPDATE CorpusTokenCandidate SET rank = 1 WHERE tokenId = 7 AND wordSlug = 'dom-NOUN'`).run()
    // ...поправил ребро и отклонил гипотезу-кандидата.
    db.prepare(`INSERT INTO CorpusDependency (sentenceId, headTokenId, depTokenId, relation, confidence, source) VALUES ('s2', 5, 7, 'obl', 'rule', 'manual')`).run()
    db.prepare(`INSERT INTO CorpusDependency (sentenceId, headTokenId, depTokenId, relation, confidence, source) VALUES ('s2', 5, 4, 'nsubj', 'rule', 'auto')`).run()
    const proposal = `INSERT INTO CorpusCandidateProposal (clusterKey, ruleSource, guessedPos, guessedStemType, guessedGrammeme, guessedStem, reconstructedForm, exampleTokenIds, status, reviewedByEmail, reviewedAt) VALUES (?, 'red_reverse_lookup', 'NOUN', 'o_hard', 'Case=Nom', ?, ?, '[1]', ?, ?, ?)`
    db.prepare(proposal).run("vidžu", "vidž", "vidž", "rejected", "mod@example.org", "2026-09-20T10:00:00.000+00:00")
    db.prepare(proposal).run("velik", "velik", "velik", "rejected", null, "2026-09-20T10:00:00.000+00:00") // автоматическое решение - не экспортируется
    return db
}

describe("corpus manual edits export/import", () => {
    it("exports only human edits", () => {
        const data = exportManual(prodCorpus(), "prod")
        expect(countManual(prodCorpus())).toEqual({ tokens: 1, dependencies: 1, proposals: 1 })
        expect(data.tokens).toHaveLength(1)
        expect(data.tokens[0]).toMatchObject({ tokenIndex: 6, surfaceForm: "dom", ordinal: 0, sentenceText: "Dom je velik dom.", candidate: { wordSlug: "dom-VERB" } })
        expect(data.dependencies[0]).toMatchObject({ relation: "obl", dep: { tokenIndex: 6 }, head: { tokenIndex: 4, surfaceForm: "je" } })
        expect(data.proposals.map((p) => p.clusterKey)).toEqual(["vidžu"])
    })

    it("re-applies edits to a rebuilt corpus where the text shifted and ids changed", () => {
        const data = exportManual(prodCorpus(), "prod")
        // Пересборка: в начало документа добавилось предложение, все id и tokenIndex другие.
        const rebuilt = corpus({ n0: "Novo.", n1: "Ja vidžu dom.", n2: "Dom je velik dom." }, [
            [100, "n0", 0, "Novo"], [101, "n1", 1, "Ja"], [102, "n1", 2, "vidžu"], [103, "n1", 3, "dom"],
            [104, "n2", 4, "Dom"], [105, "n2", 5, "je"], [106, "n2", 6, "velik"], [107, "n2", 7, "dom"],
        ])
        const report = importManual(rebuilt, data)
        expect(report.tokens).toMatchObject({ byIndex: 0, bySentence: 1, missing: [] })
        expect(report.dependencies).toMatchObject({ applied: 1, missing: [] })
        expect(report.proposals).toEqual({ updated: 0, inserted: 1 })

        expect(rebuilt.prepare(`SELECT wordSlug, resolutionSource, matchCount FROM CorpusToken WHERE id = 107`).get())
            .toEqual({ wordSlug: "dom-VERB", resolutionSource: "manual", matchCount: 1 })
        expect(rebuilt.prepare(`SELECT wordSlug, rank, source FROM CorpusTokenCandidate WHERE tokenId = 107 ORDER BY rank`).all())
            .toEqual([{ wordSlug: "dom-VERB", rank: 0, source: "manual" }, { wordSlug: "dom-NOUN", rank: 1, source: "form_freq" }])
        expect(rebuilt.prepare(`SELECT headTokenId, depTokenId, relation, source FROM CorpusDependency`).all())
            .toEqual([{ headTokenId: 105, depTokenId: 107, relation: "obl", source: "manual" }])

        // Идемпотентно: второй прогон ничего не удваивает.
        importManual(rebuilt, data)
        expect(countManual(rebuilt)).toEqual({ tokens: 1, dependencies: 1, proposals: 1 })
        expect((rebuilt.prepare(`SELECT COUNT(*) c FROM CorpusTokenCandidate WHERE tokenId = 107`).get() as { c: number }).c).toBe(2)
    })

    it("updates an existing proposal and reports tokens whose sentence is gone", () => {
        const data = exportManual(prodCorpus(), "prod")
        const rebuilt = corpus({ s1: "Ja vidžu dom.", s2: "Dom je jiny dom." }, [
            [1, "s1", 0, "Ja"], [2, "s1", 1, "vidžu"], [3, "s1", 2, "dom"],
            [4, "s2", 3, "Dom"], [5, "s2", 4, "je"], [6, "s2", 5, "jiny"], [7, "s2", 6, "domy"],
        ])
        rebuilt.prepare(`INSERT INTO CorpusCandidateProposal (clusterKey, ruleSource, guessedPos, guessedStemType, guessedGrammeme, guessedStem, reconstructedForm, exampleTokenIds) VALUES ('vidžu', 'red_reverse_lookup', 'NOUN', 'o_hard', 'Case=Nom', 'vidž', 'vidž', '[2]')`).run()
        const report = importManual(rebuilt, data)
        expect(report.tokens.missing).toHaveLength(1)
        expect(report.dependencies.missing).toHaveLength(1)
        expect(report.proposals).toEqual({ updated: 1, inserted: 0 })
        expect(rebuilt.prepare(`SELECT status, reviewedByEmail, exampleTokenIds FROM CorpusCandidateProposal`).get())
            .toEqual({ status: "rejected", reviewedByEmail: "mod@example.org", exampleTokenIds: "[2]" })
    })
})
