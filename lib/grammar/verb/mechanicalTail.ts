import { FullParadigm, ImperativeParadigm, LParticiple, ParticipleSet, ConjugationResult } from './index';

/**
 * Распознаёт "механический хвост" у многословного глагола — sę/se и/или
 * известный(е) предлог(и) (напр. "zaruciti se", "bazovati na", "bazovati se
 * na"). Такие лексемы НЕ помечены Lexeme.isCollocation (см.
 * scripts/db/2026-07-28-backfill-collocation-flag.ts) — это регулярно
 * спрягаемая конструкция: спрягается только head, tailSuffix приклеивается
 * неизменным к каждой сгенерированной форме через appendTailToConjugation.
 *
 * Используется и в lib/grammar/morphology/processors.ts (processVerb, движок
 * для корпуса/тестов), и в app/words/[id]/Word.tsx (страница слова, вызывает
 * conjugateFullVerb напрямую) — держим логику в одном месте, чтобы оба пути
 * не могли разойтись в том, что считать "механическим".
 */
export function splitMechanicalVerbTail(isv: string, knownPrepositions: string[]): { head: string; tailSuffix: string } {
    if (!isv.includes(' ')) return { head: isv, tailSuffix: '' };

    const [head, ...tail] = isv.split(/\s+/);
    const prepositions = new Set(knownPrepositions.map((p) => p.toLowerCase()));

    const isMechanicalTail = tail.length > 0 && tail.every((t) => {
        const lower = t.toLowerCase();
        if (lower === 'se' || lower === 'sę') return true;
        return lower.split('/').every((alt) => prepositions.has(alt));
    });

    if (!isMechanicalTail) return { head: isv, tailSuffix: '' };
    return { head, tailSuffix: ' ' + tail.join(' ') };
}

function appendToParadigm(p: FullParadigm, suffix: string): FullParadigm {
    return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v + suffix])) as unknown as FullParadigm;
}

function appendToParticipleSet(p: ParticipleSet, suffix: string): ParticipleSet {
    return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v + suffix])) as unknown as ParticipleSet;
}

/** Приклеивает tailSuffix ко всем словоформам (не трогает verbClass/aspect и т.п. метаданные). */
export function appendTailToConjugation(conj: ConjugationResult, tailSuffix: string): ConjugationResult {
    if (!tailSuffix) return conj;

    return {
        ...conj,
        infinitive: conj.infinitive + tailSuffix,
        lParticiple: Object.fromEntries(
            Object.entries(conj.lParticiple).map(([k, v]) => [k, v + tailSuffix])
        ) as unknown as LParticiple,
        indicative: {
            presentOrFutureDirect: appendToParadigm(conj.indicative.presentOrFutureDirect, tailSuffix),
            // Пересборка indicative здесь ручная, поэтому каждое новое поле
            // нужно протянуть явно — иначе у глаголов с механическим хвостом
            // ("zvati se") краткая парадигма молча пропадала бы.
            presentOrFutureDirectShort: conj.indicative.presentOrFutureDirectShort
                ? appendToParadigm(conj.indicative.presentOrFutureDirectShort, tailSuffix)
                : undefined,
            futureAnalytical: conj.indicative.futureAnalytical ? {
                withByti: appendToParadigm(conj.indicative.futureAnalytical.withByti, tailSuffix),
                withImati: appendToParadigm(conj.indicative.futureAnalytical.withImati, tailSuffix),
                withHtěti: appendToParadigm(conj.indicative.futureAnalytical.withHtěti, tailSuffix),
            } : undefined,
            aorist: appendToParadigm(conj.indicative.aorist, tailSuffix),
            imperfect: appendToParadigm(conj.indicative.imperfect, tailSuffix),
            perfect: {
                masculine: appendToParadigm(conj.indicative.perfect.masculine, tailSuffix),
                feminine: appendToParadigm(conj.indicative.perfect.feminine, tailSuffix),
                neuter: appendToParadigm(conj.indicative.perfect.neuter, tailSuffix),
                plural: appendToParadigm(conj.indicative.perfect.plural, tailSuffix),
            },
            pluperfect: {
                masculine: appendToParadigm(conj.indicative.pluperfect.masculine, tailSuffix),
                feminine: appendToParadigm(conj.indicative.pluperfect.feminine, tailSuffix),
            },
        },
        imperative: Object.fromEntries(
            Object.entries(conj.imperative).map(([k, v]) => [k, v + tailSuffix])
        ) as unknown as ImperativeParadigm,
        conditional: {
            masculine: appendToParadigm(conj.conditional.masculine, tailSuffix),
            feminine: appendToParadigm(conj.conditional.feminine, tailSuffix),
        },
        participles: {
            presentActive: appendToParticipleSet(conj.participles.presentActive, tailSuffix),
            presentPassive: appendToParticipleSet(conj.participles.presentPassive, tailSuffix),
            pastPassive: appendToParticipleSet(conj.participles.pastPassive, tailSuffix),
        },
    };
}
