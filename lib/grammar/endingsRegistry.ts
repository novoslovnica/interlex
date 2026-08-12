
// Case/NumberType живут и как тип (union строковых литералов — так их всегда использовал
// этот файл: endingLoader.ts/declineNoun.ts/fourTonesGenerator.ts/stemClassifier.ts), и как
// объект-значение с enum-подобными участниками (Case.NOMINATIVE и т.д.) — этот второй профиль
// нужен для консолидации с noun/index.ts, чей Case/NumberType были настоящими TS enum'ами и
// использовались как значения (Case.NOMINATIVE) в adjective/pronoun/numerals/*DeclensionTables.
// Имя типа и имя константы не конфликтуют — они живут в разных TS-неймспейсах.
//
// 2026-08-12: значения переведены с длинных английских слов ('nominative') на
// короткие UD-коды ('nom'), к которым уже давно приведена вторая, независимая
// конвенция падежа в проекте — GrammaticalCase (lib/grammar/common/case.ts),
// используемая CASE_WEIGHTS/PREPOSITION_GOVERNMENT/VerbGovernment.requiredCase
// в корпусной подсистеме. Расхождение двух конвенций не было чисто
// косметическим — оно уже тихо ломало сопоставление предложного управления и
// весов падежа в дизамбигуации омонимов (см. lib/corpus/syntax/caseUtils.ts,
// найдено при верификации Фазы 2 на реальных данных). MorphoGrammarFeats.case
// был типизирован как GrammaticalCase с самого начала — теперь рантайм-
// значение наконец соответствует объявленному типу. Имена свойств (NOMINATIVE
// и т.д.) не менялись — только их строковые значения, поэтому любой код,
// использующий Case.NOMINATIVE символически (adjective/pronoun/numerals/*,
// processors.ts через ALL_CASES), обновился автоматически без правок.
export const Case = {
    NOMINATIVE: 'nom',
    ACCUSATIVE: 'acc',
    GENITIVE: 'gen',
    DATIVE: 'dat',
    INSTRUMENTAL: 'ins',
    LOCATIVE: 'loc',
    VOCATIVE: 'voc',
} as const;
export type Case = typeof Case[keyof typeof Case];

// ИСПРАВЛЕНО: Теперь чисел строго три
export const NumberType = {
    SINGULAR: 'singular',
    PLURAL: 'plural',
    DUAL: 'dual',
} as const;
export type NumberType = typeof NumberType[keyof typeof NumberType];

// Массивы для перебора всех значений (напр. processors.ts, ранее делавший Object.values()
// над одноимённым enum'ом в noun/index.ts) — эквивалентны Object.values(Case)/(NumberType),
// но не зависят от того, что Case/NumberType остаются реальным enum-объектом.
export const ALL_CASES: Case[] = Object.values(Case);
export const ALL_NUMBERS: NumberType[] = Object.values(NumberType);

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
            nom: '',     // vlk
            acc: '',     // vlk (для неодушевленных)
            gen: 'a',       // vlka
            dat: 'u',         // vlku
            ins: 'om', // vlkom
            loc: 'ě',        // vlcě (первая палатализация k -> c)
            voc: 'e'        // vlke (звательная форма)
        },
        plural: {
            nom: 'i',     // vlci
            acc: 'y',     // vlky
            gen: '',       // vlk
            dat: 'om',       // vlkom
            ins: 'y',   // vlky
            loc: 'ěh',      // vlcěh
            voc: 'i'        // vlci (звательная форма во множественном числе)
        },
        dual: {
            nom: 'a',     // vlka (два волка)
            acc: 'a',     // vlka
            gen: 'u',       // vlku
            dat: 'oma',       // vlkoma
            ins: 'oma', // vlkoma
            loc: 'u',        // vlku
            voc: 'a'        // vlka (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 2. МУЖСКОЙ РОД: МЯГКИЕ jo-ОСНОВЫ (Пример: mųž, koń)
    // =========================================================================
    o_soft: {
        singular: {
            nom: 'j',     // końj
            acc: 'j',     // końj
            gen: 'a',       // końa
            dat: 'ju',        // końju
            ins: 'em', // końem (переход o -> e после мягкого)
            loc: 'i',        // końi
            voc: 'ju'       // końju (звательная форма)
        },
        plural: {
            nom: 'i',     // końi
            acc: 'ę',     // końę (вместо твердого y)
            gen: 'j',       // końj
            dat: 'em',       // końem
            ins: 'i',   // końi
            loc: 'ih',      // końih
            voc: 'i'        // końi (звательная форма во множественном числе)
        },
        dual: {
            nom: 'a',     // końa
            acc: 'a',     // końa
            gen: 'u',       // końu
            dat: 'ema',       // końema
            ins: 'ema', // końema
            loc: 'u',        // końu
            voc: 'a'        // końa (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 3. СРЕДНИЙ РОД: ТВЕРДЫЕ o-ОСНОВЫ (Пример: tělo, sělo, vino)
    // =========================================================================
    // Примечание: Средний род во многом совпадает с мужским, кроме Nom/Acc
    a_hard: { // Используем ключ для среднего твердого (исторически близко к o)
        singular: {
            nom: 'o',     // tělo
            acc: 'o',     // tělo (закон совпадения Nom/Acc для среднего рода)
            gen: 'a',       // těla
            dat: 'u',         // tělu
            ins: 'om', // tělom
            loc: 'ě',        // tělě
            voc: 'o'        // tělo (звательная форма совпадает с номинативом)
        },
        plural: {
            nom: 'a',     // těla (окна, тела)
            acc: 'a',     // těla
            gen: '',       // těl
            dat: 'om',       // tělom
            ins: 'y',   // těly
            loc: 'ěh',      // tělěh
            voc: 'a'        // těla (звательная форма во множественном числе)
        },
        dual: {
            nom: 'ě',     // tělě (два тела)
            acc: 'ě',     // tělě
            gen: 'u',       // tělu
            dat: 'oma',       // těloma
            ins: 'oma', // těloma
            loc: 'u',        // tělu
            voc: 'ě'        // tělě (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 4. СРЕДНИЙ РОД: МЯГКИЕ jo-ОСНОВЫ (Пример: polje, jajьce)
    // =========================================================================
    a_soft: {
        singular: {
            nom: 'e',     // polje (переход o -> e)
            acc: 'e',     // polje
            gen: 'a',       // polja
            dat: 'ju',        // polju
            ins: 'em', // poljem
            loc: 'i',        // polji
            voc: 'e'        // polje (звательная форма совпадает с номинативом)
        },
        plural: {
            nom: 'a',     // polja
            acc: 'a',     // polja
            gen: 'j',       // polj
            dat: 'em',       // poljem
            ins: 'i',   // polji
            loc: 'ih',      // poljih
            voc: 'a'        // polja (звательная форма во множественном числе)
        },
        dual: {
            nom: 'i',     // polji
            acc: 'i',     // polji
            gen: 'u',       // polju
            dat: 'ema',       // poljema
            ins: 'ema', // poljema
            loc: 'u',        // polju
            voc: 'i'        // polji (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 5. МУЖСКОЙ РОД: u-ОСНОВЫ (Пример: syn, dom)
    // =========================================================================
    u_basis: {
        singular: {
            nom: '',     // syn
            acc: '',     // syn
            gen: 'u',       // synu (историческое окончание u-основы)
            dat: 'ovi',       // synovi
            ins: 'om', // synom
            loc: 'u',        // synu
            voc: 'u'        // synu (звательная форма)
        },
        plural: {
            nom: 'ove',    // synove
            acc: 'y',     // syny
            gen: 'ov',     // synov
            dat: 'am',       // synam
            ins: 'ami', // synami
            loc: 'ěh',      // syněh
            voc: 'ove'      // synove (звательная форма во множественном числе)
        },
        dual: {
            nom: 'y',     // syny
            acc: 'y',     // syny
            gen: 'ovu',     // synovu
            dat: 'oma',       // synoma
            ins: 'ama', // synama
            loc: 'ovu',      // synovu
            voc: 'y'        // syny (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 6. ЖЕНСКИЙ/МУЖСКОЙ РОД: i-ОСНОВЫ (Пример: kostь, gostь)
    // =========================================================================
    i_basis: {
        singular: {
            nom: 'j',     // kostj
            acc: 'j',     // kostj
            gen: 'i',       // kosti
            dat: 'i',         // kosti
            ins: 'ejų', // kostejų (для ж.р.) или em (для м.р. gostem)
            loc: 'i',        // kosti
            voc: 'i'        // kosti (звательная форма)
        },
        plural: {
            nom: 'i',     // kosti
            acc: 'i',     // kosti
            gen: 'ej',     // kostej
            dat: 'em',       // kostem
            ins: 'emi', // kostemi
            loc: 'eh',      // kosteh
            voc: 'i'        // kosti (звательная форма во множественном числе)
        },
        dual: {
            nom: 'i',     // kosti
            acc: 'i',     // kosti
            gen: 'eju',     // kosteju
            dat: 'ema',       // kostema
            ins: 'ema', // kostema
            loc: 'eju',      // kosteju
            voc: 'i'        // kosti (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 7. СРЕДНИЙ РОД: КОНСОНАНТНЫЕ n-ОСНОВЫ (Пример: imę, основа imen-)
    // =========================================================================
    // Важно: в коде интерславянское слово должно передаваться уже с суффиксом основы
    consonant_n: {
        singular: {
            nom: '',      // imę (суффикс -en скрыт в Nom/Acc, обрабатывается отдельно)
            acc: '',      // imę
            gen: 'e',       // imene
            dat: 'i',         // imeni
            ins: 'em', // imenem
            loc: 'i',        // imeni
            voc: ''         // imę (звательная форма совпадает с номинативом)
        },
        plural: {
            nom: 'a',     // imena
            acc: 'a',     // imena
            gen: '',       // imen
            dat: 'em',       // imenem
            ins: 'y',   // imeny
            loc: 'eh',      // imeneh
            voc: 'a'        // imena (звательная форма во множественном числе)
        },
        dual: {
            nom: 'i',     // imeni
            acc: 'i',     // imeni
            gen: 'u',       // imenu
            dat: 'ema',       // imenema
            ins: 'ema', // imenema
            loc: 'u',        // imenu
            voc: 'i'        // imeni (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 8. СРЕДНИЙ РОД: КОНСОНАНТНЫЕ s-ОСНОВЫ (Пример: nebo, основа nebes-)
    // =========================================================================
    consonant_s: {
        singular: {
            nom: 'o',     // nebo
            acc: 'o',     // nebo
            gen: 'e',       // nebese
            dat: 'i',         // nebesi
            ins: 'em', // nebesem
            loc: 'i',        // nebesi
            voc: 'o'        // nebo (звательная форма совпадает с номинативом)
        },
        plural: {
            nom: 'a',     // nebesa
            acc: 'a',     // nebesa
            gen: '',       // nebes
            dat: 'em',       // nebesem
            ins: 'y',   // nebesy
            loc: 'eh',      // nebeseh
            voc: 'a'        // nebesa (звательная форма во множественном числе)
        },
        dual: {
            nom: 'ě',     // nebesě
            acc: 'ě',     // nebesě
            gen: 'u',       // nebesu
            dat: 'ema',       // nebesema
            ins: 'ema', // nebesema
            loc: 'u',        // nebesu
            voc: 'ě'        // nebesě (звательная форма в двойственном числе)
        }
    },

    // =========================================================================
    // 9. СРЕДНИЙ РОД: КОНСОНАНТНЫЕ ent-ОСНОВЫ (Детеныши, пример: telę, основа telent-)
    // Праслав. *-ent- (перед носовым ę→en редуцировано по той же аналогии, что ę→en в imę→imen-)
    // =========================================================================
    consonant_ent: {
        singular: {
            nom: '',      // telę
            acc: '',      // telę
            gen: 'e',       // telente
            dat: 'i',         // telenti
            ins: 'em', // telentem
            loc: 'i',        // telenti
            voc: ''         // telę (звательная форма совпадает с номинативом)
        },
        plural: {
            nom: 'a',     // telenta
            acc: 'a',     // telenta
            gen: '',       // telent
            dat: 'em',       // telentem
            ins: 'y',   // telenty
            loc: 'eh',      // telenteh
            voc: 'a'        // telenta (звательная форма во множественном числе)
        },
        dual: {
            nom: 'i',     // telenti
            acc: 'i',     // telenti
            gen: 'u',       // telentu
            dat: 'ema',       // telentema
            ins: 'ema', // telentema
            loc: 'u',        // telentu
            voc: 'i'        // telenti (звательная форма в двойственном числе)
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
            nom: 'i',     // mati (без наращения)
            acc: '',      // mater (с наращением, но с пустым окончанием)
            gen: 'e',       // matere
            dat: 'i',         // materi
            ins: 'em', // materem
            loc: 'i',        // materi
            voc: 'i'        // mati (звательная форма совпадает с номинативом)
        },
        plural: {
            nom: 'i',     // materi
            acc: 'i',     // materi
            gen: '',       // mater
            dat: 'em',       // materem
            ins: 'y',   // matery
            loc: 'eh',      // matereh
            voc: 'i'        // materi (звательная форма во множественном числе)
        },
        dual: {
            nom: 'i',     // materi
            acc: 'i',     // materi
            gen: 'u',       // materu
            dat: 'ema',       // materema
            ins: 'ema', // materema
            loc: 'u',        // materu
            voc: 'i'        // materi (звательная форма в двойственном числе)
        }
    },
};
