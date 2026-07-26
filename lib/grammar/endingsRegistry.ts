
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
    | 'consonant_s' // консонантные s-основы (nebo)
    | 'consonant_ent' // консонантные ent-основы, детеныши (telę)
    | 'consonant_er'; // консонантные er-основы, термины родства (mati)

/**
 * Реестр окончаний современного интерславянского (не праславянских реконструкций).
 * Значения извлечены 2026-07-24 из живой таблицы `ending_allophones` (флейвор CORE),
 * куда они были внесены вручную через /admin/endings поверх изначального
 * (ошибочно праславянского) сида — см. AGENTS.md, раздел про DbAnalyzer/грамматику.
 */
export const SLAVIC_ENDINGS_REGISTRY: Record<StemType, Record<NumberType, Record<Case, string>>> = {
    // =========================================================================
    // 1. МУЖСКОЙ РОД: ТВЕРДЫЕ o-ОСНОВЫ (Пример: vlk, bob, stol)
    // =========================================================================
    o_hard: {
        singular: {
            nominative: '',     // vlk
            accusative: '',     // vlk (для неодушевленных)
            genitive: 'a',       // vlka
            dative: 'u',         // vlku
            instrumental: 'om', // vlkom
            locative: 'ě',        // vlcě (первая палатализация k -> c)
            vocative: 'e'        // vlke (звательная форма)
        },
        plural: {
            nominative: 'i',     // vlci
            accusative: 'y',     // vlky
            genitive: '',       // vlk
            dative: 'om',       // vlkom
            instrumental: 'y',   // vlky
            locative: 'ěh',      // vlcěh
            vocative: 'i'        // vlci (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'a',     // vlka (два волка)
            accusative: 'a',     // vlka
            genitive: 'u',       // vlku
            dative: 'oma',       // vlkoma
            instrumental: 'oma', // vlkoma
            locative: 'u',        // vlku
            vocative: 'a'        // vlka (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 2. МУЖСКОЙ РОД: МЯГКИЕ jo-ОСНОВЫ (Пример: mųž, koń)
    // =========================================================================
    o_soft: {
        singular: {
            nominative: 'j',     // końj
            accusative: 'j',     // końj
            genitive: 'a',       // końa
            dative: 'ju',        // końju
            instrumental: 'em', // końem (переход o -> e после мягкого)
            locative: 'i',        // końi
            vocative: 'ju'       // końju (звательная форма)
        },
        plural: {
            nominative: 'i',     // końi
            accusative: 'ę',     // końę (вместо твердого y)
            genitive: 'j',       // końj
            dative: 'em',       // końem
            instrumental: 'i',   // końi
            locative: 'ih',      // końih
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
    // 3. СРЕДНИЙ РОД: ТВЕРДЫЕ o-ОСНОВЫ (Пример: tělo, sělo, vino)
    // =========================================================================
    // Примечание: Средний род во многом совпадает с мужским, кроме Nom/Acc
    a_hard: { // Используем ключ для среднего твердого (исторически близко к o)
        singular: {
            nominative: 'o',     // tělo
            accusative: 'o',     // tělo (закон совпадения Nom/Acc для среднего рода)
            genitive: 'a',       // těla
            dative: 'u',         // tělu
            instrumental: 'om', // tělom
            locative: 'ě',        // tělě
            vocative: 'o'        // tělo (звательная форма совпадает с номинативом)
        },
        plural: {
            nominative: 'a',     // těla (окна, тела)
            accusative: 'a',     // těla
            genitive: '',       // těl
            dative: 'om',       // tělom
            instrumental: 'y',   // těly
            locative: 'ěh',      // tělěh
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
    // 4. СРЕДНИЙ РОД: МЯГКИЕ jo-ОСНОВЫ (Пример: polje, jajьce)
    // =========================================================================
    a_soft: {
        singular: {
            nominative: 'e',     // polje (переход o -> e)
            accusative: 'e',     // polje
            genitive: 'a',       // polja
            dative: 'ju',        // polju
            instrumental: 'em', // poljem
            locative: 'i',        // polji
            vocative: 'e'        // polje (звательная форма совпадает с номинативом)
        },
        plural: {
            nominative: 'a',     // polja
            accusative: 'a',     // polja
            genitive: 'j',       // polj
            dative: 'em',       // poljem
            instrumental: 'i',   // polji
            locative: 'ih',      // poljih
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
    // 5. МУЖСКОЙ РОД: u-ОСНОВЫ (Пример: syn, dom)
    // =========================================================================
    u_basis: {
        singular: {
            nominative: '',     // syn
            accusative: '',     // syn
            genitive: 'u',       // synu (историческое окончание u-основы)
            dative: 'ovi',       // synovi
            instrumental: 'om', // synom
            locative: 'u',        // synu
            vocative: 'u'        // synu (звательная форма)
        },
        plural: {
            nominative: 'ove',    // synove
            accusative: 'y',     // syny
            genitive: 'ov',     // synov
            dative: 'am',       // synam
            instrumental: 'ami', // synami
            locative: 'ěh',      // syněh
            vocative: 'ove'      // synove (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'y',     // syny
            accusative: 'y',     // syny
            genitive: 'ovu',     // synovu
            dative: 'oma',       // synoma
            instrumental: 'ama', // synama
            locative: 'ovu',      // synovu
            vocative: 'y'        // syny (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 6. ЖЕНСКИЙ/МУЖСКОЙ РОД: i-ОСНОВЫ (Пример: kostь, gostь)
    // =========================================================================
    i_basis: {
        singular: {
            nominative: 'j',     // kostj
            accusative: 'j',     // kostj
            genitive: 'i',       // kosti
            dative: 'i',         // kosti
            instrumental: 'ejų', // kostejų (для ж.р.) или em (для м.р. gostem)
            locative: 'i',        // kosti
            vocative: 'i'        // kosti (звательная форма)
        },
        plural: {
            nominative: 'i',     // kosti
            accusative: 'i',     // kosti
            genitive: 'ej',     // kostej
            dative: 'em',       // kostem
            instrumental: 'emi', // kostemi
            locative: 'eh',      // kosteh
            vocative: 'i'        // kosti (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'i',     // kosti
            accusative: 'i',     // kosti
            genitive: 'eju',     // kosteju
            dative: 'ema',       // kostema
            instrumental: 'ema', // kostema
            locative: 'eju',      // kosteju
            vocative: 'i'        // kosti (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 7. СРЕДНИЙ РОД: КОНСОНАНТНЫЕ n-ОСНОВЫ (Пример: imę, основа imen-)
    // =========================================================================
    // Важно: в коде интерславянское слово должно передаваться уже с суффиксом основы
    consonant_n: {
        singular: {
            nominative: '',      // imę (суффикс -en скрыт в Nom/Acc, обрабатывается отдельно)
            accusative: '',      // imę
            genitive: 'e',       // imene
            dative: 'i',         // imeni
            instrumental: 'em', // imenem
            locative: 'i',        // imeni
            vocative: ''         // imę (звательная форма совпадает с номинативом)
        },
        plural: {
            nominative: 'a',     // imena
            accusative: 'a',     // imena
            genitive: '',       // imen
            dative: 'em',       // imenem
            instrumental: 'y',   // imeny
            locative: 'eh',      // imeneh
            vocative: 'a'        // imena (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'i',     // imeni
            accusative: 'i',     // imeni
            genitive: 'u',       // imenu
            dative: 'ema',       // imenema
            instrumental: 'ema', // imenema
            locative: 'u',        // imenu
            vocative: 'i'        // imeni (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 8. СРЕДНИЙ РОД: КОНСОНАНТНЫЕ s-ОСНОВЫ (Пример: nebo, основа nebes-)
    // =========================================================================
    consonant_s: {
        singular: {
            nominative: 'o',     // nebo
            accusative: 'o',     // nebo
            genitive: 'e',       // nebese
            dative: 'i',         // nebesi
            instrumental: 'em', // nebesem
            locative: 'i',        // nebesi
            vocative: 'o'        // nebo (звательная форма совпадает с номинативом)
        },
        plural: {
            nominative: 'a',     // nebesa
            accusative: 'a',     // nebesa
            genitive: '',       // nebes
            dative: 'em',       // nebesem
            instrumental: 'y',   // nebesy
            locative: 'eh',      // nebeseh
            vocative: 'a'        // nebesa (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'ě',     // nebesě
            accusative: 'ě',     // nebesě
            genitive: 'u',       // nebesu
            dative: 'ema',       // nebesema
            instrumental: 'ema', // nebesema
            locative: 'u',        // nebesu
            vocative: 'ě'        // nebesě (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 9. СРЕДНИЙ РОД: КОНСОНАНТНЫЕ ent-ОСНОВЫ (Детеныши, пример: telę, основа telent-)
    // Праслав. *-ent- (перед носовым ę→en редуцировано по той же аналогии, что ę→en в imę→imen-)
    // =========================================================================
    consonant_ent: {
        singular: {
            nominative: '',      // telę
            accusative: '',      // telę
            genitive: 'e',       // telente
            dative: 'i',         // telenti
            instrumental: 'em', // telentem
            locative: 'i',        // telenti
            vocative: ''         // telę (звательная форма совпадает с номинативом)
        },
        plural: {
            nominative: 'a',     // telenta
            accusative: 'a',     // telenta
            genitive: '',       // telent
            dative: 'em',       // telentem
            instrumental: 'y',   // telenty
            locative: 'eh',      // telenteh
            vocative: 'a'        // telenta (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'i',     // telenti
            accusative: 'i',     // telenti
            genitive: 'u',       // telentu
            dative: 'ema',       // telentema
            instrumental: 'ema', // telentema
            locative: 'u',        // telentu
            vocative: 'i'        // telenti (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 10. ЖЕНСКИЙ РОД: КОНСОНАНТНЫЕ er-ОСНОВЫ (Термины родства, пример: mati, основа mater-)
    // Праслав. mati/matere/materi/materь/materьjǫ/materi/mati (еры сняты, instr./loc.
    // унифицированы по образцу остальных консонантных основ). В отличие от en/es/ent,
    // винительный падеж ед.ч. ("mater") уже несёт наращение — не совпадает с именительным ("mati").
    // =========================================================================
    consonant_er: {
        singular: {
            nominative: 'i',     // mati (без наращения)
            accusative: '',      // mater (с наращением, но с пустым окончанием)
            genitive: 'e',       // matere
            dative: 'i',         // materi
            instrumental: 'em', // materem
            locative: 'i',        // materi
            vocative: 'i'        // mati (звательная форма совпадает с номинативом)
        },
        plural: {
            nominative: 'i',     // materi
            accusative: 'i',     // materi
            genitive: '',       // mater
            dative: 'em',       // materem
            instrumental: 'y',   // matery
            locative: 'eh',      // matereh
            vocative: 'i'        // materi (звательная форма во множественном числе)
        },
        dual: {
            nominative: 'i',     // materi
            accusative: 'i',     // materi
            genitive: 'u',       // materu
            dative: 'ema',       // materema
            instrumental: 'ema', // materema
            locative: 'u',        // materu
            vocative: 'i'        // materi (звательная форма в двойственном числе)
        }
    },
};
