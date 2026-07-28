import { GrammaticalCase } from '@/lib/grammar/common';

// Грамматический движок (lib/grammar/endingsRegistry.ts, "Case" как
// объект-константа) отдаёт падеж полным словом в рантайме ('nominative',
// 'accusative', ...), несмотря на то что тип MorphoGrammarFeats.case
// формально объявлен короткими кодами — предсуществующая нестыковка двух
// параллельных обозначений падежа в проекте (см. lib/grammar/common/case.ts,
// который использует короткие коды и от которого зависят CASE_WEIGHTS/
// PREPOSITION_GOVERNMENT/VerbGovernment.requiredCase). Не унифицируется
// здесь — блок для отдельной задачи с более широким радиусом (затрагивает и
// отображение граммем в TokenSidebar/CorpusTokenDisplay). Используется и
// DbAnalyzer (управление предлога), и resolveHomonymsViaSyntax (управление
// глагола) — единственное общее место для этой нормализации.
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
