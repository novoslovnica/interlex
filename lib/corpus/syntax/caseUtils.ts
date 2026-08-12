import { GrammaticalCase } from '@/lib/grammar/common';

/**
 * ИСТОРИЧЕСКИ (найдено при верификации Фазы 2 на реальных данных corpus.db):
 * `MorphoGrammarFeats.case` типизирован как GrammaticalCase (короткие коды
 * 'nom'/'acc'/'gen'/'dat'/'loc'/'ins'/'voc', lib/grammar/common/case.ts), но
 * в реальных строках CorpusToken.feats встречались ОБА представления
 * одновременно — и короткие коды, и полные английские слова, потому что
 * lib/grammar/endingsRegistry.ts's `Case` (использует processors.ts/
 * generateWordForms — именно он пишет case в feats при разборе корпуса) сам
 * хранил падеж полным словом. Рассогласование двух параллельных case-enum'ов
 * уже тихо ломало PREPOSITION_GOVERNMENT/getExpectedCasesForPreposition и
 * CASE_WEIGHTS/hotUpdate.ts (сравнение всегда шло против коротких кодов).
 *
 * ИСПРАВЛЕНО 2026-08-12: движок (endingsRegistry.ts's Case, по аналогии с
 * миграцией ǫ→ų — с подтверждением мейнтейнера) переведён на те же короткие
 * UD-коды. normalizeCase() здесь оставлен как страховка для уже сохранённых
 * в corpus.db строк с длинными кодами (записаны до фикса), не для новых.
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
