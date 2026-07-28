import { GrammaticalCase } from '@/lib/grammar/common';

/**
 * ВАЖНО, найдено при верификации Фазы 2 на реальных данных corpus.db:
 * `MorphoGrammarFeats.case` типизирован как GrammaticalCase (короткие коды
 * 'nom'/'acc'/'gen'/'dat'/'loc'/'ins'/'voc', lib/grammar/common/case.ts), но
 * в реальных строках CorpusToken.feats встречаются ОБА представления
 * одновременно — и короткие коды, и полные английские слова
 * ('nominative'/'accusative'/... из отдельного, второго enum `Case` в
 * lib/grammar/endingsRegistry.ts, который использует processors.ts/
 * generateWordForms — именно он реально пишет case в feats при разборе
 * корпуса). Это не ошибка Фазы 2 — рассогласование двух параллельных
 * case-enum'ов существовало до неё и, судя по всему, уже тихо ломает
 * PREPOSITION_GOVERNMENT/getExpectedCasesForPreposition (сравнение всегда
 * было против коротких кодов) и CASE_WEIGHTS/hotUpdate.ts в lib/corpus/priorities/
 * (сравнение по тем же коротким ключам). Здесь — только точечная нормализация
 * для модуля синтаксиса; переписывать сам движок (processors.ts) — отдельная,
 * более рискованная задача, требующая подтверждения мейнтейнера (по аналогии
 * с миграцией ǫ→ų), не входит в Фазу 2.
 */
const CASE_ALIASES: Record<string, GrammaticalCase> = {
    nom: GrammaticalCase.NOM,
    nominative: GrammaticalCase.NOM,
    acc: GrammaticalCase.ACC,
    accusative: GrammaticalCase.ACC,
    gen: GrammaticalCase.GEN,
    genitive: GrammaticalCase.GEN,
    dat: GrammaticalCase.DAT,
    dative: GrammaticalCase.DAT,
    loc: GrammaticalCase.LOC,
    locative: GrammaticalCase.LOC,
    ins: GrammaticalCase.INS,
    instrumental: GrammaticalCase.INS,
    voc: GrammaticalCase.VOC,
    vocative: GrammaticalCase.VOC,
};

export function normalizeCase(value: string | undefined | null): GrammaticalCase | undefined {
    if (!value) return undefined;
    return CASE_ALIASES[value.toLowerCase()];
}
