import Database from "better-sqlite3"
import path from "path"
import { prismaData } from "@/lib/prisma"
import { normalizeSurfaceForm } from "./reconstruct"
import { findExistingLexemes } from "./existingLexemes"

// Признаки кластера очереди, отделяющие иностранные слова от заимствований,
// которые начинают работать как межславянские. Решение принято с мейнтейнером
// 2026-09-15: закрытый класс (английские служебные слова) отсекается
// автоматически, знаменательные слова — никогда. Их только откладывают, пока
// нет признаков освоения, и возвращают, как только признаки появятся.
//
// Порог и признаки сняты с корпуса, а не заданы на глаз. Средняя доля
// распознанных межславянских слов в предложениях со словом:
//   the/of/and — 0,43/0,43/0,32; cyrillic, letter (цитаты) — 0,38;
//   google, youtube, discord, diskord (в межславянском тексте) — 0,82–0,88;
//   nahoslav, fialomira (ники) — 0,93–0,94, но всего 8–9 документов на 550–700
//   вхождений.
// Словоизменение: diskordu (275), diskorda (108), youtubu (35), googla (3).
export const FOREIGN_CONTEXT_THRESHOLD = 0.55

export const FUNCTION_WORD_NOTE = "автоматически: английское служебное слово"
export const FOREIGN_CONTEXT_NOTE = "автоматически: иностранный контекст"

const MAX_SIBLINGS = 8
const MIN_STEM_LENGTH = 3
const MAX_ENDING_LENGTH = 4

// Закрытый класс английских служебных слов. Из списка намеренно исключены
// омографы межславянских слов: a, i, to, on, no, by, so, me, my, one, more,
// most, in. Проверка по словарю ниже — вторая страховка.
export const ENGLISH_FUNCTION_WORDS = new Set([
    "the", "of", "and", "is", "are", "was", "were", "be", "been", "being",
    "with", "for", "from", "this", "that", "these", "those", "you", "your",
    "it", "its", "we", "they", "their", "them", "he", "she", "his", "her",
    "our", "us", "have", "has", "had", "not", "or", "but", "if", "at", "as",
    "an", "will", "would", "can", "could", "should", "what", "which", "who",
    "how", "when", "where", "there", "here", "about", "into", "than", "then",
    "just", "also", "only", "all", "any", "some", "other", "such", "very",
    "do", "does", "did", "get", "got",
])

export type ClusterSignal = "foreign_function_word" | "foreign_context" | null

/**
 * Для каждого ключа — другие ключи той же основы с другим межславянским
 * окончанием: google/googla/googlu, diskord/diskordu. Основа — ключ без
 * окончания из ending_allophones (или сам ключ), не короче трёх букв.
 */
export function inflectedSiblingIndex(keys: string[], endings: string[]): Map<string, string[]> {
    const usableEndings = [...new Set(endings)].filter((e) => e.length > 0 && e.length <= MAX_ENDING_LENGTH)
    const stemsOf = new Map<string, string[]>()
    const byStem = new Map<string, Set<string>>()

    for (const key of keys) {
        const stems = [key]
        for (const ending of usableEndings) {
            if (key.length - ending.length >= MIN_STEM_LENGTH && key.endsWith(ending)) {
                stems.push(key.slice(0, -ending.length))
            }
        }
        stemsOf.set(key, stems)
        for (const stem of stems) {
            const group = byStem.get(stem)
            if (group) group.add(key)
            else byStem.set(stem, new Set([key]))
        }
    }

    const result = new Map<string, string[]>()
    for (const [key, stems] of stemsOf) {
        const siblings = new Set<string>()
        for (const stem of stems) {
            for (const other of byStem.get(stem) ?? []) {
                if (other !== key) siblings.add(other)
            }
        }
        result.set(key, [...siblings].sort().slice(0, MAX_SIBLINGS))
    }
    return result
}

export function classifyClusterSignal(input: {
    clusterKey: string
    isvContextShare: number | null
    inflectedSiblings: string[]
    knownAsLexeme: boolean
}): ClusterSignal {
    if (ENGLISH_FUNCTION_WORDS.has(input.clusterKey) && !input.knownAsLexeme) return "foreign_function_word"
    // Словоизменение перевешивает контекст: слово с межславянскими окончаниями
    // уже работает в грамматике, даже если часто стоит рядом с английским.
    if (input.isvContextShare !== null && input.isvContextShare < FOREIGN_CONTEXT_THRESHOLD && input.inflectedSiblings.length === 0) {
        return "foreign_context"
    }
    return null
}

function corpusDbPath(): string {
    const url = process.env.CORPUS_DATABASE_URL ?? "file:./corpus.db"
    return path.resolve(process.cwd(), url.replace(/^file:/, ""))
}

export interface ClusterSignalStats {
    clusters: number
    functionWords: number
    foreignContext: number
    withInflectedSiblings: number
    rejected: number
    deferred: number
    restored: number
}

/**
 * Пересчитывает CorpusClusterSignal для всех открытых кластеров очереди и
 * применяет статусы: английские служебные слова — rejected, иностранный
 * контекст без словоизменения — deferred (и не возвращается в работу, пока
 * признак не пропадёт). Решения модератора не трогаются: меняются только
 * pending/deferred.
 *
 * Работает прямым better-sqlite3, а не Prisma: временная таблица статистики по
 * предложениям должна жить в одном соединении, а агрегат по 5 млн токенов через
 * Prisma шёл бы на порядок медленнее. Около минуты на полном корпусе.
 */
export async function computeClusterSignals(pendingMinOccurrences = 2): Promise<ClusterSignalStats> {
    const endingRows = await prismaData.endingAllophone.findMany({ select: { value: true } })
    const endings = endingRows.map((r) => r.value)

    const db = new Database(corpusDbPath())
    try {
        db.exec(`DROP TABLE IF EXISTS temp.signal_sentence`)
        db.exec(`
            CREATE TEMP TABLE signal_sentence AS
            SELECT sentenceId,
                   COUNT(*) AS words,
                   SUM(CASE WHEN matchCount > 0 AND isPartialMatch = 0 THEN 1 ELSE 0 END) AS recognized
            FROM "CorpusToken" WHERE wordIndex <> -1 GROUP BY sentenceId
        `)
        db.exec(`CREATE INDEX temp.signal_sentence_idx ON signal_sentence(sentenceId)`)

        // Токен сам нераспознан, поэтому доля считается по остальным словам
        // предложения: recognized / (words - 1).
        const formRows = db.prepare(`
            SELECT lower(t.surfaceForm) AS form,
                   COUNT(*) AS occ,
                   COUNT(DISTINCT t.documentSlug) AS docs,
                   SUM(CASE WHEN s.words > 1 THEN 1.0 * s.recognized / (s.words - 1) ELSE 0 END) AS ctxSum,
                   SUM(CASE WHEN s.words > 1 THEN 1 ELSE 0 END) AS ctxN
            FROM "CorpusToken" t JOIN signal_sentence s ON s.sentenceId = t.sentenceId
            WHERE t.wordIndex <> -1 AND (t.matchCount = 0 OR (t.matchCount = 1 AND t.isPartialMatch = 1))
            GROUP BY lower(t.surfaceForm)
        `).all() as { form: string; occ: number; docs: number; ctxSum: number; ctxN: number }[]

        // lower() в SQLite не знает кириллицы и диакритики — окончательная
        // нормализация та же, что у генератора.
        const stats = new Map<string, { occ: number; docs: number; ctxSum: number; ctxN: number }>()
        for (const row of formRows) {
            const key = normalizeSurfaceForm(row.form)
            if (!key) continue
            const acc = stats.get(key)
            if (acc) {
                acc.occ += row.occ
                acc.docs += row.docs
                acc.ctxSum += row.ctxSum
                acc.ctxN += row.ctxN
            } else {
                stats.set(key, { occ: row.occ, docs: row.docs, ctxSum: row.ctxSum, ctxN: row.ctxN })
            }
        }

        const siblings = inflectedSiblingIndex([...stats.keys()], endings)
        const openKeys = (db.prepare(
            `SELECT DISTINCT clusterKey FROM "CorpusCandidateProposal" WHERE status IN ('pending', 'deferred')`,
        ).all() as { clusterKey: string }[]).map((r) => r.clusterKey)

        const signalRows: { clusterKey: string; occ: number; docs: number; ctx: number | null; siblings: string[]; signal: ClusterSignal }[] = []
        for (const clusterKey of openKeys) {
            const s = stats.get(clusterKey)
            if (!s) continue
            const ctx = s.ctxN > 0 ? s.ctxSum / s.ctxN : null
            const clusterSiblings = siblings.get(clusterKey) ?? []
            const knownAsLexeme = ENGLISH_FUNCTION_WORDS.has(clusterKey) && (await findExistingLexemes(clusterKey)).length > 0
            signalRows.push({
                clusterKey,
                occ: s.occ,
                docs: s.docs,
                ctx,
                siblings: clusterSiblings,
                signal: classifyClusterSignal({ clusterKey, isvContextShare: ctx, inflectedSiblings: clusterSiblings, knownAsLexeme }),
            })
        }

        const insert = db.prepare(`
            INSERT INTO "CorpusClusterSignal" (clusterKey, occurrenceCount, documentCount, isvContextShare, inflectedSiblings, signal)
            VALUES (?, ?, ?, ?, ?, ?)
        `)
        let rejected = 0
        let deferred = 0
        let restored = 0
        db.transaction(() => {
            db.exec(`DELETE FROM "CorpusClusterSignal"`)
            for (const r of signalRows) {
                insert.run(r.clusterKey, r.occ, r.docs, r.ctx === null ? null : Math.round(r.ctx * 1000) / 1000, JSON.stringify(r.siblings), r.signal)
            }
            rejected = db.prepare(`
                UPDATE "CorpusCandidateProposal" SET status = 'rejected', resolutionNote = ?
                WHERE status IN ('pending', 'deferred')
                  AND clusterKey IN (SELECT clusterKey FROM "CorpusClusterSignal" WHERE signal = 'foreign_function_word')
            `).run(FUNCTION_WORD_NOTE).changes
            deferred = db.prepare(`
                UPDATE "CorpusCandidateProposal" SET status = 'deferred', resolutionNote = ?
                WHERE status = 'pending'
                  AND clusterKey IN (SELECT clusterKey FROM "CorpusClusterSignal" WHERE signal = 'foreign_context')
            `).run(FOREIGN_CONTEXT_NOTE).changes
            // Признак пропал (слово начало склоняться или попадать в межславянский
            // контекст) — возвращаем в работу, если хватает вхождений.
            restored = db.prepare(`
                UPDATE "CorpusCandidateProposal" SET status = 'pending', resolutionNote = NULL
                WHERE status = 'deferred' AND resolutionNote = ? AND occurrenceCount >= ?
                  AND clusterKey NOT IN (SELECT clusterKey FROM "CorpusClusterSignal" WHERE signal = 'foreign_context')
            `).run(FOREIGN_CONTEXT_NOTE, pendingMinOccurrences).changes
        })()

        return {
            clusters: signalRows.length,
            functionWords: signalRows.filter((r) => r.signal === "foreign_function_word").length,
            foreignContext: signalRows.filter((r) => r.signal === "foreign_context").length,
            withInflectedSiblings: signalRows.filter((r) => r.siblings.length > 0).length,
            rejected,
            deferred,
            restored,
        }
    } finally {
        db.close()
    }
}
