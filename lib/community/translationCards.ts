import type Database from "better-sqlite3"
import { randomUUID } from "crypto"
import { evaluateConsensus, type CommunityStatus, type Verdict } from "./consensus"
import { getContributorWeight, refreshContributorStats, settleVotes } from "./stats"

// Публичные карточки проверки перевода: выбор следующей карточки и приём
// ответа. Всё синхронно на better-sqlite3 (как lib/translations.ts) - приём
// ответа должен быть одной транзакцией: голос, счётчики и исход согласия
// не могут разойтись.

export { SUGGESTED_VALUE_MAX_LENGTH, VOTE_COMMENT_MAX_LENGTH } from "./constants"

// Из скольких самых частотных карточек выбирать случайно. Строго "самая
// частотная" выдала бы одну и ту же карточку всем волонтёрам одновременно.
const SELECTION_WINDOW = 200

export interface TranslationCard {
    translationId: number
    language: string
    value: string
    meaningId: number
    meaningText: string | null
    examples: string | null
    lexemeId: number
    slug: string | null
    isv: string | null
    pos: string | null
    context: { ru: string | null; en: string | null }
}

interface CardRow extends CardSourceRow {
    value: string
    started: number
}

// Пул: перевод не отмечен модератором (verified IS NOT 1 покрывает и 0, и
// NULL), не пустой, согласие ещё не достигнуто, слово публичное и с частью
// речи, и этот пользователь по нему ещё не отвечал. Порядок: сначала уже
// начатые (довести до согласия важнее, чем открыть новую), затем по
// частотности слова.
export function selectNextCard(
    db: Database.Database,
    params: { userId: string; language: string; random?: () => number }
): TranslationCard | null {
    const rows = db.prepare(`
        SELECT t.id AS translationId, t.value AS value, m.id AS meaningId, m.meaning AS meaningText,
               m.examples AS examples, l.id AS lexemeId, l.slug AS slug, l.value AS lexemeValue, l.pos AS pos,
               (t.communityYes + t.communityNo > 0) AS started
        FROM translations t
        JOIN meanings m ON m.id = t.meaningId
        JOIN lexemes l ON l.id = m.lexemeId
        WHERE t.language = ?
          AND t.verified IS NOT 1
          AND t.communityStatus IS NULL
          AND t.value IS NOT NULL AND TRIM(t.value) != ''
          AND l.isPublic = 1
          AND l.pos IS NOT NULL AND l.pos != ''
          AND NOT EXISTS (SELECT 1 FROM translation_votes v WHERE v.translationId = t.id AND v.userId = ? AND v.stale = 0)
        ORDER BY started DESC, COALESCE(l.corpusFrequencyPerMln, 0) DESC, t.id ASC
        LIMIT ${SELECTION_WINDOW}
    `).all(params.language, params.userId) as CardRow[]
    if (rows.length === 0) return null

    const started = rows.filter((row) => row.started)
    const pool = started.length > 0 ? started : rows
    const random = params.random ?? Math.random
    const row = pool[Math.floor(random() * pool.length)]

    return hydrateCard(db, row, params.language, row.value)
}

export interface CardSourceRow {
    translationId: number
    meaningId: number
    meaningText: string | null
    examples: string | null
    lexemeId: number
    slug: string | null
    lexemeValue: string | null
    pos: string | null
}

// Общая сборка карточки - и для обычных, и для контрольных (controlCards.ts):
// снаружи они обязаны быть неотличимы, поэтому собираются одним кодом.
// shownValue - что показать как проверяемый перевод (у обманки это чужое значение).
export function hydrateCard(db: Database.Database, row: CardSourceRow, language: string, shownValue: string): TranslationCard {
    const core = db.prepare(`
        SELECT la.value AS value FROM lexeme_allophones la
        JOIN allophone_flavors af ON af.id = la.flavorId
        WHERE la.lexemeId = ? AND af.code = 'CORE' AND la.type = 'standard'
        LIMIT 1
    `).get(row.lexemeId) as { value: string | null } | undefined

    const contextValue = (contextLanguage: string) =>
        (db.prepare(`
            SELECT value FROM translations
            WHERE meaningId = ? AND language = ? AND value IS NOT NULL AND TRIM(value) != ''
            ORDER BY (verified IS 1) DESC, id ASC LIMIT 1
        `).get(row.meaningId, contextLanguage) as { value: string } | undefined)?.value ?? null

    return {
        translationId: row.translationId,
        language,
        value: shownValue,
        meaningId: row.meaningId,
        meaningText: row.meaningText,
        examples: row.examples,
        lexemeId: row.lexemeId,
        slug: row.slug,
        isv: core?.value ?? row.lexemeValue,
        pos: row.pos,
        // Проверяемый язык в подсказку не идёт - иначе карточка подсказывает сама себе.
        context: {
            ru: language === "ru" ? null : contextValue("ru"),
            en: language === "en" ? null : contextValue("en"),
        },
    }
}

export type CastVoteError = "not_found" | "language_mismatch" | "closed" | "already_voted"

export type CastVoteResult =
    | { ok: true; status: CommunityStatus | null }
    | { ok: false; error: CastVoteError }

export function castVote(
    db: Database.Database,
    params: {
        userId: string
        translationId: number
        language: string
        verdict: Verdict
        suggestedValue?: string | null
        comment?: string | null
        weight?: number
    }
): CastVoteResult {
    const run = db.transaction((): CastVoteResult => {
        const translation = db.prepare(`
            SELECT t.id, t.language, t.value, t.verified, t.communityStatus, m.lexemeId AS lexemeId
            FROM translations t JOIN meanings m ON m.id = t.meaningId
            WHERE t.id = ?
        `).get(params.translationId) as {
            id: number; language: string; value: string | null; verified: number | null
            communityStatus: string | null; lexemeId: number
        } | undefined

        if (!translation) return { ok: false, error: "not_found" }
        if (translation.language !== params.language) return { ok: false, error: "language_mismatch" }
        // Пока карточка была на экране, её мог закрыть модератор или третий голос.
        if (translation.verified === 1 || translation.communityStatus !== null) return { ok: false, error: "closed" }

        const duplicate = db.prepare(`SELECT 1 FROM translation_votes WHERE translationId = ? AND userId = ? AND stale = 0`)
            .get(params.translationId, params.userId)
        if (duplicate) return { ok: false, error: "already_voted" }

        // Предложенный вариант имеет смысл только при "неверно".
        const suggestedValue = params.verdict === "no" ? (params.suggestedValue?.trim() || null) : null
        db.prepare(`
            INSERT INTO translation_votes (translationId, language, userId, verdict, suggestedValue, comment, valueSnapshot, weight)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            params.translationId, params.language, params.userId, params.verdict,
            suggestedValue, params.comment?.trim() || null, translation.value,
            // Вес снимается в момент ответа и задним числом не пересчитывается.
            params.weight ?? getContributorWeight(db, params.userId, params.language)
        )

        // Счётчики пересчитываются из голосов, а не инкрементируются: так
        // они не могут уплыть от таблицы голосов ни при каком сбое.
        const tally = db.prepare(`
            SELECT COALESCE(SUM(CASE WHEN verdict = 'yes' THEN weight END), 0) AS yes,
                   COALESCE(SUM(CASE WHEN verdict = 'no' THEN weight END), 0) AS no,
                   COUNT(CASE WHEN verdict IN ('yes', 'no') AND weight > 0 THEN 1 END) AS decisive
            FROM translation_votes
            WHERE translationId = ? AND stale = 0 AND isControl = 0
        `).get(params.translationId) as { yes: number; no: number; decisive: number }

        const status = evaluateConsensus(tally)
        db.prepare(`
            UPDATE translations
            SET communityYes = ?, communityNo = ?, communityStatus = ?,
                communityResolvedAt = CASE WHEN ? IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END
            WHERE id = ?
        `).run(tally.yes, tally.no, status, status, params.translationId)

        if (status !== null) {
            // Исход согласия - запись в историю слова от имени сообщества,
            // а не последнего проголосовавшего: решение коллективное.
            // Синхронный INSERT вместо logAudit - внутри db.transaction
            // нельзя await (тот же приём в app/admin/deduplication/actions.ts).
            db.prepare(`
                INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail)
                VALUES (?, 'Lexeme', ?, ?, NULL, ?, NULL, 'community')
            `).run(randomUUID(), translation.lexemeId, `${params.language}.communityStatus`, status)
        }

        // Согласие - предварительный итог для оценки участников; если потом
        // модератор решит иначе, его settleVotes перезапишет. "disputed"
        // итогом не является - ждёт модератора.
        if (status === "confirmed") settleVotes(db, params.translationId, "yes")
        else if (status === "rejected") settleVotes(db, params.translationId, "no")
        // Свой счётчик ответов растёт с каждым голосом, не только при исходе.
        refreshContributorStats(db, params.userId, params.language)

        return { ok: true, status }
    })
    return run()
}

// Перевод изменился или его закрыл модератор - собранные ответы относились
// к прежнему значению. Вызывается из upsertTranslation в его же транзакции.
export function resetCommunityReview(db: Database.Database, translationId: number): void {
    db.prepare(`UPDATE translation_votes SET stale = 1 WHERE translationId = ? AND stale = 0`).run(translationId)
    db.prepare(`
        UPDATE translations SET communityYes = 0, communityNo = 0, communityStatus = NULL, communityResolvedAt = NULL
        WHERE id = ?
    `).run(translationId)
}
