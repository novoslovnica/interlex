import type Database from "better-sqlite3"
import { hydrateCard, type CardSourceRow, type TranslationCard } from "./translationCards"
import { getControlAnswerCount, refreshContributorStats } from "./stats"
import type { Verdict } from "./consensus"
import type { CardKind } from "./cardToken"

// Контрольные карточки: ответ известен заранее, в согласие не идут
// (isControl=1), нужны только для оценки участника. Ловят "кликаю всегда
// Верно" и дают репутации сигнал с первого дня, не дожидаясь согласий.
//
//   control_yes - перевод с отметкой модератора (verified=1), показан как есть;
//   control_no  - "обманка": то же значение слова, но в качестве перевода
//                 показано значение перевода ДРУГОГО слова той же части речи.
//                 Собирается на лету и нигде не сохраняется - лингвистический
//                 факт не фабрикуется.
//
// Известная погрешность: случайное чужое слово изредка может оказаться
// допустимым переводом (синонимом). Поэтому порог флага мягкий (<50% на 10+
// контрольных, lib/community/reputation.ts), а не "одна ошибка".

// Новичка калибруем быстрее: пока контрольных ответов мало, их доля выше.
const CONTROL_SHARE_NEW = 0.25
const CONTROL_SHARE_REGULAR = 0.1
const NEW_CONTRIBUTOR_CONTROLS = 10

export function shouldServeControl(db: Database.Database, userId: string, language: string, random: () => number = Math.random): boolean {
    const share = getControlAnswerCount(db, userId, language) < NEW_CONTRIBUTOR_CONTROLS ? CONTROL_SHARE_NEW : CONTROL_SHARE_REGULAR
    return random() < share
}

interface ControlRow extends CardSourceRow {
    value: string
}

export function selectControlCard(
    db: Database.Database,
    params: { userId: string; language: string; random?: () => number }
): { card: TranslationCard; kind: Exclude<CardKind, "regular"> } | null {
    const random = params.random ?? Math.random

    // Частотные слова: по редкому слову и носитель честно ответит "не знаю",
    // а такой ответ репутации ничего не даёт. Голосов с stale=0 по
    // контрольному переводу у пользователя быть не должно - один перевод
    // служит контрольной карточкой одному человеку один раз.
    const row = db.prepare(`
        SELECT t.id AS translationId, t.value AS value, m.id AS meaningId, m.meaning AS meaningText,
               m.examples AS examples, l.id AS lexemeId, l.slug AS slug, l.value AS lexemeValue, l.pos AS pos
        FROM translations t
        JOIN meanings m ON m.id = t.meaningId
        JOIN lexemes l ON l.id = m.lexemeId
        WHERE t.language = ?
          AND t.verified = 1
          AND t.value IS NOT NULL AND TRIM(t.value) != ''
          AND l.isPublic = 1
          AND l.pos IS NOT NULL AND l.pos != ''
          AND COALESCE(l.corpusFrequencyPerMln, 0) > 0
          AND NOT EXISTS (SELECT 1 FROM translation_votes v WHERE v.translationId = t.id AND v.userId = ? AND v.stale = 0)
        ORDER BY RANDOM() LIMIT 1
    `).get(params.language, params.userId) as ControlRow | undefined
    if (!row) return null // в языке нет ни одного проверенного перевода (hsb, dsb, mk) - контролировать нечем

    if (random() < 0.5) {
        return { card: hydrateCard(db, row, params.language, row.value), kind: "control_yes" }
    }

    const decoy = db.prepare(`
        SELECT t.value AS value
        FROM translations t
        JOIN meanings m ON m.id = t.meaningId
        JOIN lexemes l ON l.id = m.lexemeId
        WHERE t.language = ? AND t.verified = 1
          AND t.value IS NOT NULL AND TRIM(t.value) != ''
          AND l.pos = ? AND l.id != ?
          AND LOWER(t.value) != LOWER(?)
        ORDER BY RANDOM() LIMIT 1
    `).get(params.language, row.pos, row.lexemeId, row.value) as { value: string } | undefined
    if (!decoy) return { card: hydrateCard(db, row, params.language, row.value), kind: "control_yes" }

    return { card: hydrateCard(db, row, params.language, decoy.value), kind: "control_no" }
}

export type ControlVoteResult = { ok: true } | { ok: false; error: "not_found" | "language_mismatch" | "already_voted" }

export function castControlVote(
    db: Database.Database,
    params: { userId: string; translationId: number; language: string; verdict: Verdict; kind: Exclude<CardKind, "regular"> }
): ControlVoteResult {
    const run = db.transaction((): ControlVoteResult => {
        const translation = db.prepare(`SELECT language, value FROM translations WHERE id = ?`)
            .get(params.translationId) as { language: string; value: string | null } | undefined
        if (!translation) return { ok: false, error: "not_found" }
        if (translation.language !== params.language) return { ok: false, error: "language_mismatch" }

        const duplicate = db.prepare(`SELECT 1 FROM translation_votes WHERE translationId = ? AND userId = ? AND stale = 0`)
            .get(params.translationId, params.userId)
        if (duplicate) return { ok: false, error: "already_voted" }

        const expected = params.kind === "control_yes" ? "yes" : "no"
        // "Не знаю" на контрольной - не ошибка: agreed остаётся NULL и в точность не идёт.
        const agreed = params.verdict === "unknown" ? null : (params.verdict === expected ? 1 : 0)
        db.prepare(`
            INSERT INTO translation_votes (translationId, language, userId, verdict, valueSnapshot, weight, isControl, controlExpected, agreed)
            VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
        `).run(
            params.translationId, params.language, params.userId, params.verdict,
            // У обманки показанное значение чужое и нигде не хранится - снимок пустой.
            params.kind === "control_yes" ? translation.value : null,
            expected, agreed
        )
        refreshContributorStats(db, params.userId, params.language)
        return { ok: true }
    })
    return run()
}
