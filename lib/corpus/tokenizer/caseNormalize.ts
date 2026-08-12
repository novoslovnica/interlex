import { GrammaticalCase } from '@/lib/grammar/common';

// ИСТОРИЧЕСКИ: грамматический движок (lib/grammar/endingsRegistry.ts, "Case"
// как объект-константа) отдавал падеж полным словом в рантайме ('nominative',
// 'accusative', ...), несмотря на то что тип MorphoGrammarFeats.case
// формально объявлен короткими кодами (lib/grammar/common/case.ts,
// GrammaticalCase) — от которых зависят CASE_WEIGHTS/PREPOSITION_GOVERNMENT/
// VerbGovernment.requiredCase. ИСПРАВЛЕНО 2026-08-12: Case теперь тоже
// использует короткие UD-коды в качестве значений (см. коммент над Case в
// endingsRegistry.ts) — движок с этого момента и так отдаёт короткие коды.
// Эта функция оставлена как страховка для уже сохранённых в corpus.db
// CorpusToken.feats с длинными кодами (записаны до фикса) — не удалять, пока
// не подтверждено, что весь корпус переразмечен. Используется и DbAnalyzer
// (управление предлога), и resolveHomonymsViaSyntax (управление глагола).
const CASE_LONG_TO_SHORT: Record<string, GrammaticalCase> = {
    nominative: GrammaticalCase.NOM,
    accusative: GrammaticalCase.ACC,
    genitive: GrammaticalCase.GEN,
    dative: GrammaticalCase.DAT,
    instrumental: GrammaticalCase.INS,
    locative: GrammaticalCase.LOC,
    vocative: GrammaticalCase.VOC,
};

export function normalizeCaseValue(value: string | undefined | null): GrammaticalCase | undefined {
    if (!value) return undefined;
    return CASE_LONG_TO_SHORT[value] ?? (value as GrammaticalCase);
}
