// Classic SM-2 (SuperMemo 2) spaced-repetition scheduling algorithm,
// exactly as originally published (P.A. Woźniak, 1987) - the same core
// algorithm Anki's default scheduler descends from. Kept as a pure function
// (no DB/Date.now() side effects) so it's fully unit-testable and the
// caller controls "now" explicitly.

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

// UI-facing simplification of the 0-5 SM-2 quality scale to four buttons -
// the same collapsing most SM-2-derived apps (Anki included) use, since
// asking a learner to self-rate on a raw 0-5 scale is unintuitive.
export const QUALITY_BY_BUTTON = {
    again: 0,
    hard: 3,
    good: 4,
    easy: 5,
} as const satisfies Record<string, ReviewQuality>;
export type ReviewButton = keyof typeof QUALITY_BY_BUTTON;

export interface SrsCardState {
    easeFactor: number;
    intervalDays: number;
    repetitions: number;
}

export interface SrsReviewResult extends SrsCardState {
    nextReviewAt: Date;
}

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

export const DEFAULT_SRS_STATE: SrsCardState = {
    easeFactor: DEFAULT_EASE_FACTOR,
    intervalDays: 0,
    repetitions: 0,
};

/**
 * Applies one SM-2 review step. `quality` >= 3 counts as a successful
 * recall (interval grows); quality < 3 ("Again") resets the card back to
 * repetitions=0 with a 1-day interval, same as forgetting a card entirely.
 */
export function sm2Review(state: SrsCardState, quality: ReviewQuality, now: Date = new Date()): SrsReviewResult {
    let { easeFactor, intervalDays, repetitions } = state;

    // Interval is computed from the *pre-review* ease factor, and only
    // then is the ease factor itself updated for next time - this order
    // matters (reversing it changes the resulting interval) and matches
    // the canonical SM-2 pseudocode, not an arbitrary choice.
    if (quality < 3) {
        repetitions = 0;
        intervalDays = 1;
    } else {
        if (repetitions === 0) {
            intervalDays = 1;
        } else if (repetitions === 1) {
            intervalDays = 6;
        } else {
            intervalDays = Math.round(intervalDays * easeFactor);
        }
        repetitions += 1;
    }

    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < MIN_EASE_FACTOR) easeFactor = MIN_EASE_FACTOR;

    const nextReviewAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    return { easeFactor, intervalDays, repetitions, nextReviewAt };
}
