import { prismaCorpus } from "@/lib/prisma";

export interface CorpusExample {
    sentenceId: string;
    text: string;
    surfaceForm: string;
    documentTitle: string;
    documentSlug: string;
    sourceUrl: string | null;
}

const DEFAULT_LIMIT = 3;

/**
 * A handful of real corpus sentences using this word, for display on the
 * word-detail page (see AGENTS.md's roadmap item "Corpus examples on the
 * word page" - the two modules had never been connected before, despite
 * CorpusToken.wordSlug already linking a token to its lexeme).
 *
 * corpus.db is a separate database from interlex.db (see the project-wide
 * "never cross database boundaries in a single query" rule) - this is a
 * three-phase fetch (tokens -> sentences -> documents) entirely within
 * corpus.db; the caller is responsible for resolving `wordSlug` from
 * interlex.db first (Lexeme.slug) and merging the result in application code.
 *
 * Only matchCount=1, isPartialMatch=false ("green") tokens are used - a
 * still-ambiguous or stem-only-matched ("yellow") token isn't a confident
 * enough attestation of this specific word to show as an example.
 */
export async function fetchWordExamples(wordSlug: string, limit = DEFAULT_LIMIT): Promise<CorpusExample[]> {
    if (!wordSlug) return [];

    const tokens = await prismaCorpus.corpusToken.findMany({
        where: { wordSlug, matchCount: 1, isPartialMatch: false },
        select: { sentenceId: true, surfaceForm: true },
        // Over-fetch: several tokens can land in the same sentence (the word
        // used twice, or another word from the same document already
        // sampled) - deduped by sentenceId below before slicing to `limit`.
        take: limit * 5,
        orderBy: { id: "asc" },
    });

    const seenSentences = new Set<string>();
    const uniqueTokens = tokens.filter((t) => {
        if (seenSentences.has(t.sentenceId)) return false;
        seenSentences.add(t.sentenceId);
        return true;
    }).slice(0, limit);

    if (uniqueTokens.length === 0) return [];

    const sentences = await prismaCorpus.corpusSentence.findMany({
        where: { id: { in: uniqueTokens.map((t) => t.sentenceId) } },
        select: { id: true, rawText: true, documentSlug: true },
    });
    const sentenceById = new Map(sentences.map((s) => [s.id, s]));

    const documentSlugs = [...new Set(sentences.map((s) => s.documentSlug))];
    const documents = await prismaCorpus.corpusDocument.findMany({
        where: { slug: { in: documentSlugs } },
        select: { slug: true, title: true, sourceUrl: true },
    });
    const documentBySlug = new Map(documents.map((d) => [d.slug, d]));

    const examples: CorpusExample[] = [];
    for (const token of uniqueTokens) {
        const sentence = sentenceById.get(token.sentenceId);
        if (!sentence) continue;
        const doc = documentBySlug.get(sentence.documentSlug);
        examples.push({
            sentenceId: sentence.id,
            text: sentence.rawText,
            surfaceForm: token.surfaceForm,
            documentTitle: doc?.title ?? sentence.documentSlug,
            documentSlug: sentence.documentSlug,
            sourceUrl: doc?.sourceUrl ?? null,
        });
    }

    return examples;
}
