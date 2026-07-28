/**
 * Канонические имена связей Universal Dependencies (https://universaldependencies.org/u/dep/).
 * Единственный источник имён deprel для парсера — нигде больше в
 * lib/corpus/syntax не должно быть строковых литералов вида 'nsubj' напрямую,
 * только через эти константы, чтобы имена гарантированно оставались
 * стандартными UD-именами (по требованию: "нужно только поддерживать UD
 * именования").
 *
 * Отмечено, какие связи реально расставляются в каждой фазе — остальные
 * зарезервированы под Фазы 3–4 (сочинение/подчинение), но объявлены здесь
 * заранее, чтобы таксономия была видна целиком.
 */
export const UD_DEPREL = {
    // Фаза 2 — NP-чанкинг и падежное присоединение простого предложения
    ROOT: 'root',
    NSUBJ: 'nsubj',
    OBJ: 'obj',
    IOBJ: 'iobj',
    OBL: 'obl',
    AMOD: 'amod',
    NMOD: 'nmod',
    DET: 'det',
    NUMMOD: 'nummod',
    ADVMOD: 'advmod',
    CASE: 'case',
    AUX: 'aux',
    COP: 'cop',
    EXPL: 'expl',
    DISCOURSE: 'discourse',
    PUNCT: 'punct',
    DEP: 'dep', // канонический UD-фолбэк "известна зависимость, тип не определён"

    // Фаза 3 — сочинение (внутри ИГ и на уровне клаузы: сказуемые, аргументы)
    CC: 'cc',
    CONJ: 'conj',

    // Зарезервировано под Фазу 4 (подчинение, сложные предложения) — не расставляется в Фазе 2
    MARK: 'mark',
    ADVCL: 'advcl',
    CCOMP: 'ccomp',
    XCOMP: 'xcomp',
    ACL: 'acl',
    PARATAXIS: 'parataxis',
} as const;

export type UdDeprel = typeof UD_DEPREL[keyof typeof UD_DEPREL];
