
export type Case = 'nominative' | 'accusative' | 'genitive' | 'dative' | 'instrumental' | 'locative' | 'vocative';
// ИСПРАВЛЕНО: Теперь чисел строго три
export type NumberType = 'singular' | 'plural' | 'dual';

export interface WordFormRequest {
    interslavicWord: string;
    paradigm: 'A' | 'B' | 'C';
    gender: 'masculine' | 'feminine' | 'neuter';
    targetCase: Case;
    targetNumber: NumberType;
}


// Расширяем типы для точной идентификации класса склонения
export type StemType =
    | 'o_hard' | 'o_soft' | 'a_hard' | 'a_soft'
    | 'u_basis'  // u-основы (synъ)
    | 'i_basis'  // i-основы (kostь, gostь)
    | 'consonant_n' // консонантные n-основы (imę)
    | 'consonant_s'; // консонантные s-основы (nebo)

/**
 * Глобальный реестр праславянских окончаний (Единственное, Множественное, Двойственное)
 */
export const SLAVIC_ENDINGS_REGISTRY: Record<StemType, Record<NumberType, Record<Case, string>>> = {
    // =========================================================================
    // 1. МУЖСКОЙ РОД: ТВЕРДЫЕ o-ОСНОВЫ (Пример: *vьlkъ, *bobъ, *stolъ)
    // =========================================================================
    o_hard: {
        singular: {
            nominative: 'ъ',     // vьlkъ
            accusative: 'ъ',     // vьlkъ (для неодушевленных/древних форм)
            genitive: 'a',       // vьlka
            dative: 'u',         // vьlku
            instrumental: 'omъ', // vьlkomъ
            locative: 'ě',        // vьlcě (первая палатализация k -> c)
            vocative: 'e'        // vьlke (звательная форма)
        },
        plural: {
            nominative: 'i',     // vьlci
            accusative: 'y',     // vьlky
            genitive: 'ъ',       // vьlkъ
            dative: 'omъ',       // vьlkomъ
            instrumental: 'y',   // vьlky
            locative: 'ěxъ',      // vьlcěxъ
            vocative: 'i'        // vьlci (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'a',     // vьlka (два волка)
            accusative: 'a',     // vьlka
            genitive: 'u',       // vьlku
            dative: 'oma',       // vьlkoma
            instrumental: 'oma', // vьlkoma
            locative: 'u',        // vьlku
            vocative: 'a'        // vьlka (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 2. МУЖСКОЙ РОД: МЯГКИЕ jo-ОСНОВЫ (Пример: *mǫžь, *końь)
    // =========================================================================
    o_soft: {
        singular: {
            nominative: 'ь',     // końь
            accusative: 'ь',     // końь
            genitive: 'a',       // końa
            dative: 'ju',        // końu / końaju
            instrumental: 'emъ', // końemъ (переход o -> e после мягкого)
            locative: 'i',        // końi
            vocative: 'ju'       // końju (звательная форма)
        },
        plural: {
            nominative: 'i',     // końi
            accusative: 'ę',     // końę (вместо твердого y)
            genitive: 'ь',       // końь
            dative: 'emъ',       // końemъ
            instrumental: 'i',   // końi
            locative: 'ixъ',      // końixъ
            vocative: 'i'        // końi (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'a',     // końa
            accusative: 'a',     // końa
            genitive: 'u',       // końu
            dative: 'ema',       // końema
            instrumental: 'ema', // końema
            locative: 'u',        // końu
            vocative: 'a'        // końa (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 3. СРЕДНИЙ РОД: ТВЕРДЫЕ o-ОСНОВЫ (Пример: *tělo, *sělo, *wino)
    // =========================================================================
    // Примечание: Средний род во многом совпадает с мужским, кроме Nom/Acc
    a_hard: { // Используем ключ для среднего твердого (исторически близко к o)
        singular: {
            nominative: 'o',     // tělo
            accusative: 'o',     // tělo (закон совпадения Nom/Acc для среднего рода)
            genitive: 'a',       // těla
            dative: 'u',         // tělu
            instrumental: 'omъ', // tělomъ
            locative: 'ě',        // tělě
            vocative: 'o'        // tělo (звательная форма совпадает с номинативом)
        },
        plural: {
            nominative: 'a',     // těla (окна, тела)
            accusative: 'a',     // těla
            genitive: 'ъ',       // tělъ
            dative: 'omъ',       // tělomъ
            instrumental: 'y',   // těly
            locative: 'ěxъ',      // tělěxъ
            vocative: 'a'        // těla (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'ě',     // tělě (два тела)
            accusative: 'ě',     // tělě
            genitive: 'u',       // tělu
            dative: 'oma',       // těloma
            instrumental: 'oma', // těloma
            locative: 'u',        // tělu
            vocative: 'ě'        // tělě (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 4. СРЕДНИЙ РОД: МЯГКИЕ jo-ОСНОВЫ (Пример: *polje, *ajьce)
    // =========================================================================
    a_soft: {
        singular: {
            nominative: 'e',     // polje (переход o -> e)
            accusative: 'e',     // polje
            genitive: 'a',       // polja
            dative: 'ju',        // polju
            instrumental: 'emъ', // poljemъ
            locative: 'i',        // polji
            vocative: 'e'        // polje (звательная форма совпадает с номинативом)
        },
        plural: {
            nominative: 'a',     // polja
            accusative: 'a',     // polja
            genitive: 'ь',       // poljь
            dative: 'emъ',       // poljemъ
            instrumental: 'i',   // polji
            locative: 'ixъ',      // poljixъ
            vocative: 'a'        // polja (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'i',     // polji
            accusative: 'i',     // polji
            genitive: 'u',       // polju
            dative: 'ema',       // poljema
            instrumental: 'ema', // poljema
            locative: 'u',        // polju
            vocative: 'i'        // polji (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 5. МУЖСКОЙ РОД: u-ОСНОВЫ (Пример: *synъ, *domъ)
    // =========================================================================
    u_basis: {
        singular: {
            nominative: 'ъ',     // synъ
            accusative: 'ъ',     // synъ
            genitive: 'u',       // synu (историческое окончание u-основы)
            dative: 'ovi',       // synovi
            instrumental: 'ъmъ', // synъmъ
            locative: 'u',        // synu
            vocative: 'u'        // synu (звательная форма)
        },
        plural: {
            nominative: 'ove',    // synove
            accusative: 'y',     // syny
            genitive: 'ovъ',     // synovъ
            dative: 'ъmъ',       // synъmъ
            instrumental: 'ъmi', // synъmi
            locative: 'ъxъ',      // synъxъ
            vocative: 'ove'      // synove (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'y',     // syny
            accusative: 'y',     // syny
            genitive: 'ovu',     // synovju
            dative: 'ъma',       // synъma
            instrumental: 'ъma', // synъma
            locative: 'ovu',      // synovju
            vocative: 'y'        // syny (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 6. ЖЕНСКИЙ/МУЖСКОЙ РОД: i-ОСНОВЫ (Пример: *kostь, *gostь)
    // =========================================================================
    i_basis: {
        singular: {
            nominative: 'ь',     // kostь
            accusative: 'ь',     // kostь
            genitive: 'i',       // kosti
            dative: 'i',         // kosti
            instrumental: 'ьjǫ', // kostьjǫ (для ж.р.) или ьmъ (для м.р. gostьmъ)
            locative: 'i',        // kosti
            vocative: 'i'        // kosti (звательная форма)
        },
        plural: {
            nominative: 'i',     // kosti
            accusative: 'i',     // kosti
            genitive: 'ьjъ',     // kostьjъ
            dative: 'ьmъ',       // kostьmъ
            instrumental: 'ьmi', // kostьmi
            locative: 'ьxъ',      // kostьxъ
            vocative: 'i'        // kosti (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'i',     // kosti
            accusative: 'i',     // kosti
            genitive: 'ьju',     // kostьju
            dative: 'ьma',       // kostьma
            instrumental: 'ьma', // kostьma
            locative: 'ьju',      // kostьju
            vocative: 'i'        // kosti (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 7. СРЕДНИЙ РОД: КОНСОНАНТНЫЕ n-ОСНОВЫ (Пример: *imę, основа *imen-)
    // =========================================================================
    // Важно: в коде интерславянское слово должно передаваться уже с суффиксом основы
    consonant_n: {
        singular: {
            nominative: '',      // imę (суффикс -en скрыт в Nom/Acc, обрабатывается отдельно)
            accusative: '',      // imę
            genitive: 'e',       // imene
            dative: 'i',         // imeni
            instrumental: 'ьmъ', // imenьmъ
            locative: 'i',        // imeni
            vocative: ''         // imę (звательная форма совпадает с номинативом)
        },
        plural: {
            nominative: 'a',     // imena
            accusative: 'a',     // imena
            genitive: 'ъ',       // imenъ
            dative: 'ьmъ',       // imenьmъ
            instrumental: 'y',   // imeny
            locative: 'ьxъ',      // imenьxъ
            vocative: 'a'        // imena (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'i',     // imeni
            accusative: 'i',     // imeni
            genitive: 'u',       // imenu
            dative: 'ьma',       // imenьma
            instrumental: 'ьma', // imenьma
            locative: 'u',        // imenu
            vocative: 'i'        // imeni (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 8. СРЕДНИЙ РОД: КОНСОНАНТНЫЕ s-ОСНОВЫ (Пример: *nebo, основа *nebes-)
    // =========================================================================
    consonant_s: {
        singular: {
            nominative: 'o',     // nebo
            accusative: 'o',     // nebo
            genitive: 'e',       // nebese
            dative: 'i',         // nebesi
            instrumental: 'ьmъ', // nebesьmъ
            locative: 'i',        // nebesi
            vocative: 'o'        // nebo (звательная форма совпадает с номинативом)
        },
        plural: {
            nominative: 'a',     // nebesa
            accusative: 'a',     // nebesa
            genitive: 'ъ',       // nebesъ
            dative: 'ьmъ',       // nebesьmъ
            instrumental: 'y',   // nebesy
            locative: 'ьxъ',      // nebesьxъ
            vocative: 'a'        // nebesa (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'ě',     // nebesě
            accusative: 'ě',     // nebesě
            genitive: 'u',       // nebesu
            dative: 'ьma',       // nebesьma
            instrumental: 'ьma', // nebesьma
            locative: 'u',        // nebesu
            vocative: 'ě'        // nebesě (звательная форма в двойственном числе)
        }
    },
};
