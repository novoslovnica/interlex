import { EngineWordInput, GeneratedForm, MorphoGrammarFeats } from '@/lib/grammar/morphology';
import {
    GrammaticalGender,
    AccentParadigm,
    ProtoStemClass,
    VerbalAspect,
    PosType,
    AdjectiveTypeClass, StemExtension,
} from '@/lib/grammar/common';
// Импортируем изолированные движки трех классов числительных
import { generateNumeralForm, EnhancedNumDbItem } from '../numerals/cardinal';
import { declineOrdinalNumeral, OrdinalDbItem } from '../numerals/ordinal';
import { declineCollectiveNumeral, CollectiveDbItem, CollectiveClass } from '../numerals/collective';
import { Case, NumberType, declineWordAutomatically, EnhancedDbItem } from '../noun';
import {
    conjugateFullVerb,
    extractProtoStems,
    VerbModel,
    FullParadigm
} from '../verb';
import { generateAdjectiveForm, EnhancedAdjDbItem } from '../adjective';
import { generatePronounForm, EnhancedPronounDbItem, PronounClass } from '../pronoun';

/**
 * Процессор Существительных (NOUN)
 * Генерирует полный массив падежных и числовых словоформ с расчетом 4 праславянских тонов.
 */
export function processNoun(word: EngineWordInput): GeneratedForm[] {
    if (!word.isv) {
        return [{ surfaceForm: '', feats: {} }];
    }

    const results: GeneratedForm[] = [];

    // 1. Безопасно приводим сырые метаданные из Word к строгим системным Enum
    const dbItem: EnhancedDbItem = {
        interslavic: word.isv,
        protoSlavic: word.isv, // Используем лемму как фоллбэк для расчета вокалических ядер
        pos: PosType.NOUN,
        paradigm: (word.paradigm as AccentParadigm) || AccentParadigm.A,
        gender: (word.gender as GrammaticalGender) || GrammaticalGender.MASC,
        protoStemClass: (word.protoStemClass as ProtoStemClass) || ProtoStemClass.O_SHORT,
        stemExtension: (word.stemExtension as StemExtension) || StemExtension.NONE
    };

    // 2. Разворачиваем полную матрицу форм (7 падежей * 3 числа = 21 словоформа)
    const cases = Object.values(Case);
    const numbers = Object.values(NumberType);

    for (const num of numbers) {
        for (const cas of cases) {
            // Генерируем чистую падежную форму (без предлога для базового индексатора)
            const form = declineWordAutomatically({
                dbItem,
                targetCase: cas,
                targetNumber: num,
                flavor: word.flavor
            });

            // Мапим внутренние строгие типы на формат выдачи корпуса GeneratedForm
            results.push({
                surfaceForm: form,
                feats: {
                    case: cas, // 'nominative' | 'genitive' ...
                    number: num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du',
                    gender: dbItem.gender.toLowerCase() as 'masc' | 'fem' | 'neut'
                }
            });
        }
    }

    return results;
}

/**
 * Вспомогательный хелпер для безопасного переноса плоских парадигм (1sg, 2sg...)
 * в результирующий массив GeneratedForm с кастомными грамматическими признаками.
 */
function pushParadigmToResults(
    results: GeneratedForm[],
    paradigm: FullParadigm,
    baseFeats: MorphoGrammarFeats
): void {
    (Object.keys(paradigm) as Array<keyof FullParadigm>).forEach((key) => {
        // Расшифровываем лицо и число из ключей ('1sg', '3pl', '2du' и т.д.)
        const person = key.charAt(0) as '1' | '2' | '3';
        const numMarker = key.substring(1);
        const number = numMarker === 'sg' ? 'sg' : numMarker === 'pl' ? 'pl' : 'du';

        results.push({
            surfaceForm: paradigm[key],
            feats: {
                ...baseFeats,
                person,
                number,
            },
        });
    });
}

/**
 * Процессор Глаголов (VERB)
 * Разворачивает инфинитив во все формы изъявительного и повелительного наклонений,
 * а также причастия, рассчитывая праславянские звуковые чередования и 4 тона.
 */
export function processVerb(word: EngineWordInput): GeneratedForm[] {
    if (!word.isv) {
        return [{ surfaceForm: '', feats: {} }];
    }

    const results: GeneratedForm[] = [];

    // 1. Сначала добавляем сам инфинитив как базовую форму
    results.push({
        surfaceForm: word.isv,
        feats: { verbForm: 'inf' }
    });

    // 2. Автоматически восстанавливаем праславянские основы по Лескину (инфинитив, презенс, аорист)
    const stems = extractProtoStems(word.isv);

    // 3. Если есть secondaryStem (из колонки addition в CSV), используем его как presentStem
    const presentStem = word.secondaryStem || stems.presentStem;

    // 4. Формируем строгую модель VerbModel для передачи в акцентологический калькулятор
    const verbModel: VerbModel = {
        infinitive: word.isv,
        infStem: stems.infStem,
        presentStem: presentStem,
        aoristStem: stems.aoristStem,
        tertiaryStem: word.tertiaryStem || undefined,
        verbClass: stems.verbClass,
        aspect: (word.aspect as VerbalAspect) || VerbalAspect.IPF,
        paradigm: (word.paradigm as AccentParadigm) || AccentParadigm.A,
    };

    // 4. Запускаем генерацию полной глагольной матрицы
    const conj = conjugateFullVerb(verbModel);

    // 5. Плоское уплотнение (Flattening) результатов с заполнением грамматического атласа feats

    // А. Настоящее / Будущее простое время (Презенс)
    pushParadigmToResults(results, conj.indicative.presentOrFutureDirect, {
        verbForm: 'fin',
        tense: verbModel.aspect === VerbalAspect.PF ? 'fut' : 'pres',
        mood: 'ind'
    });

    // Б. Аорист
    pushParadigmToResults(results, conj.indicative.aorist, {
        verbForm: 'fin',
        tense: 'aor',
        mood: 'ind'
    });

    // В. Имперфект
    pushParadigmToResults(results, conj.indicative.imperfect, {
        verbForm: 'fin',
        tense: 'impf',
        mood: 'ind'
    });

    // Г. Повелительное наклонение (Императив)
    // Извлекаем ключи из специфической структуры ImperativeParadigm
    const imp = conj.imperative;
    const impKeys: Array<keyof typeof imp> = ['2sg', '1du', '2du', '1pl', '2pl'];

    impKeys.forEach((key) => {
        const person = key.charAt(0) as '1' | '2' | '3';
        const numMarker = key.substring(1);
        const number = numMarker === 'sg' ? 'sg' : numMarker === 'pl' ? 'pl' : 'du';

        results.push({
            surfaceForm: imp[key],
            feats: {
                verbForm: 'fin',
                mood: 'imp',
                person,
                number
            }
        });
    });

    // Д. L-причастия (Основа перфекта, плюсквамперфекта и кондиционала)
    const lp = conj.lParticiple;
    results.push(
        { surfaceForm: lp.masculine, feats: { verbForm: 'part', gender: 'masc', number: 'sg', tense: 'past' } },
        { surfaceForm: lp.feminine, feats: { verbForm: 'part', gender: 'fem', number: 'sg', tense: 'past' } },
        { surfaceForm: lp.neuter, feats: { verbForm: 'part', gender: 'neut', number: 'sg', tense: 'past' } },
        { surfaceForm: lp.plural_masculine, feats: { verbForm: 'part', gender: 'masc', number: 'pl', tense: 'past' } },
        { surfaceForm: lp.plural_feminine_neuter, feats: { verbForm: 'part', gender: 'fem', number: 'pl', tense: 'past' } },
        { surfaceForm: lp.dual_masculine, feats: { verbForm: 'part', gender: 'masc', number: 'du', tense: 'past' } },
        { surfaceForm: lp.dual_feminine_neuter, feats: { verbForm: 'part', gender: 'fem', number: 'du', tense: 'past' } }
    );

    // Е. Причастия: активные настоящего времени (-ǫšti/-ęťi)
    const pa = conj.participles.presentActive;
    results.push(
        { surfaceForm: pa.masculine, feats: { verbForm: 'part', gender: 'masc', number: 'sg', tense: 'pres', voice: 'act' } },
        { surfaceForm: pa.feminine, feats: { verbForm: 'part', gender: 'fem', number: 'sg', tense: 'pres', voice: 'act' } },
        { surfaceForm: pa.neuter, feats: { verbForm: 'part', gender: 'neut', number: 'sg', tense: 'pres', voice: 'act' } },
        { surfaceForm: pa.plural, feats: { verbForm: 'part', gender: 'masc', number: 'pl', tense: 'pres', voice: 'act' } },
    );

    // Ж. Причастия: пассивные настоящего времени (-omyj/-imyj)
    const pp = conj.participles.presentPassive;
    results.push(
        { surfaceForm: pp.masculine, feats: { verbForm: 'part', gender: 'masc', number: 'sg', tense: 'pres', voice: 'pass' } },
        { surfaceForm: pp.feminine, feats: { verbForm: 'part', gender: 'fem', number: 'sg', tense: 'pres', voice: 'pass' } },
        { surfaceForm: pp.neuter, feats: { verbForm: 'part', gender: 'neut', number: 'sg', tense: 'pres', voice: 'pass' } },
        { surfaceForm: pp.plural, feats: { verbForm: 'part', gender: 'masc', number: 'pl', tense: 'pres', voice: 'pass' } },
    );

    // З. Причастия: пассивные прошедшего времени (-enyj/-tyj/-nyj)
    const ppa = conj.participles.pastPassive;
    results.push(
        { surfaceForm: ppa.masculine, feats: { verbForm: 'part', gender: 'masc', number: 'sg', tense: 'past', voice: 'pass' } },
        { surfaceForm: ppa.feminine, feats: { verbForm: 'part', gender: 'fem', number: 'sg', tense: 'past', voice: 'pass' } },
        { surfaceForm: ppa.neuter, feats: { verbForm: 'part', gender: 'neut', number: 'sg', tense: 'past', voice: 'pass' } },
        { surfaceForm: ppa.plural, feats: { verbForm: 'part', gender: 'masc', number: 'pl', tense: 'past', voice: 'pass' } },
    );

    return results;
}

/**
 * Процессор Прилагательных (ADJ)
 * Генерирует полную матрицу падежных, числовых и родовых форм (63 словоформы)
 * с точным расчётом праславянских акцентных типов и четырёх тонов.
 */
/**
 * Обновленный Процессор Прилагательных (ADJ)
 * Умная развертка: относительные генерируют только базовые формы,
 * качественные — разворачивают полную падежно-родовую сетку для всех трех степеней сравнения.
 */
export function processAdjective(word: EngineWordInput): GeneratedForm[] {
    if (!word.isv) {
        return [{ surfaceForm: '', feats: {} }];
    }

    const results: GeneratedForm[] = [];

    const paradigm = (word.paradigm as AccentParadigm) || AccentParadigm.A;
    const protoStemClass = (word.protoStemClass as ProtoStemClass) || ProtoStemClass.O_SHORT;

    // Автоматический или ручной детекшн типа прилагательного.
    // Качественные прилагательные межславянского обычно заканчиваются на -vy, -ky, -ry, -by, -ly
    let adjClass: AdjectiveTypeClass = 'relative';
    const cleanLemma = word.isv.toLowerCase().trim();

    if (
        cleanLemma.endsWith('ovy') ||
        cleanLemma.endsWith('evy') ||
        cleanLemma.endsWith('ny') ||
        cleanLemma.endsWith('sky')
    ) {
        adjClass = 'relative'; // Относительные суффиксы (-овый, -ный, -ский) не имеют степеней
    } else {
        adjClass = 'qualitative'; // Базовые качественные (novy, bely, veliky, stari)
    }

    const dbItem: EnhancedAdjDbItem = {
        interslavic: word.isv,
        protoSlavic: word.isv,
        paradigm,
        protoStemClass,
        adjClass
    };

    const cases = Object.values(Case);
    const numbers = Object.values(NumberType);
    const genders = Object.values(GrammaticalGender);

    // Определяем массив итерируемых степеней
    const degrees: ('pos' | 'comp' | 'sup')[] = adjClass === 'qualitative'
        ? ['pos', 'comp', 'sup']
        : ['pos'];

    // Четырехмерный высокоточный лингвистический цикл сборки парадигмы
    for (const deg of degrees) {
        for (const num of numbers) {
            for (const gen of genders) {
                for (const cas of cases) {

                    const form = generateAdjectiveForm({
                        dbItem,
                        targetCase: cas,
                        targetNumber: num,
                        targetGender: gen,
                        degree: deg
                    });

                    results.push({
                        surfaceForm: form,
                        feats: {
                            case: cas,
                            number: num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du',
                            gender: gen.toLowerCase() as 'masc' | 'fem' | 'neut',
                            degree: deg // Напрямую пишем 'pos' | 'comp' | 'sup' в аналитический атлас
                        }
                    });
                }
            }
        }
    }

    return results;
}

/**
 * Процессор Местоимений (PRON)
 * Разворачивает словарную форму во все возможные падежные, числовые и родовые формы,
 * автоматически разделяя их на полные (ударные) и энклитические (безударные) варианты.
 */
export function processPronoun(word: EngineWordInput): GeneratedForm[] {
    if (!word.isv) {
        return [{ surfaceForm: '', feats: {} }];
    }

    const results: GeneratedForm[] = [];

    // Местоимения ja/ty/on по умолчанию мобильны (C), остальные — стационарны (A)
    const paradigm = (word.paradigm as AccentParadigm) ||
        (['ja', 'ty', 'on'].includes(word.isv.toLowerCase()) ? AccentParadigm.C : AccentParadigm.A);

    // Вычисляем морфологический класс местоимения
    const pronClass: PronounClass = ['ja', 'ty', 'on'].includes(word.isv.toLowerCase())
        ? 'personal'
        : 'demonstrative_who_what';

    const dbItem: EnhancedPronounDbItem = {
        interslavic: word.isv,
        protoSlavic: word.isv,
        paradigm,
        pronClass
    };

    const cases = Object.values(Case);
    const numbers = Object.values(NumberType);
    const genders = Object.values(GrammaticalGender);

    // =========================================================================
    // СТРАТЕГИЯ 1: ЛИЧНЫЕ МЕСТОИМЕНИЯ 1-ГО И 2-ГО ЛИЦА (ja, ty)
    // =========================================================================
    if (pronClass === 'personal' && (word.isv.toLowerCase() === 'ja' || word.isv.toLowerCase() === 'ty')) {
        for (const num of numbers) {
            for (const cas of cases) {
                // 1. Генерируем полную ударную форму (н-р: "mene")
                const fullForm = generatePronounForm({ dbItem, targetCase: cas, targetNumber: num, isEnclitic: false });
                results.push({
                    surfaceForm: fullForm,
                    feats: {
                        case: cas,
                        number: num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du',
                        degree: 'full' as any
                    }
                });

                // 2. Генерируем краткую безударную энклитику (н-р: "mę")
                const shortForm = generatePronounForm({ dbItem, targetCase: cas, targetNumber: num, isEnclitic: true });

                // Добавляем в результаты только если система имеет реальный энклитический аналог для этого падежа
                if (shortForm !== fullForm) {
                    results.push({
                        surfaceForm: shortForm,
                        feats: {
                            case: cas,
                            number: num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du',
                            degree: 'short' as any
                        }
                    });
                }
            }
        }
    }
        // =========================================================================
        // СТРАТЕГИЯ 2: ВОПРОСИТЕЛЬНЫЕ (kto, čto) И АНАФОРИЧЕСКИЕ (on, ona, ono)
    // =========================================================================
    else {
        for (const gen of genders) {
            for (const cas of cases) {
                const form = generatePronounForm({
                    dbItem,
                    targetCase: cas,
                    targetNumber: NumberType.SINGULAR,
                    targetGender: gen
                });

                results.push({
                    surfaceForm: form,
                    feats: {
                        case: cas,
                        number: 'sg',
                        gender: gen.toLowerCase() as 'masc' | 'fem' | 'neut'
                    }
                });
            }
        }
    }

    return results;
}

/**
 * Процессор Числительных (NUM)
 * Генерирует полный массив падежных, родовых и числовых словоформ.
 */
export function processNumeral(word: EngineWordInput): GeneratedForm[] {
    if (!word.isv) {
        return [{ surfaceForm: '', feats: {} }];
    }

    const results: GeneratedForm[] = [];

    // Извлекаем или безопасно дефолтим метаданные из вашей таблицы Word
    const paradigm = (word.paradigm as AccentParadigm) || AccentParadigm.A;
    const protoStemClass = (word.protoStemClass as ProtoStemClass) || ProtoStemClass.O_SHORT;

    // Определяем категорию числительного на основе его морфологических признаков или суффиксов.
    // В продакшене это поле "numeralType" должно извлекаться напрямую из метаданных Word в Main DB.
    let numeralType: 'cardinal' | 'ordinal' | 'collective' = 'cardinal';

    if (word.isv.endsWith('y') || word.isv.endsWith('i') && word.stem?.endsWith('j')) {
        // Порядковые на -y/-i (pěrvy, tretji)
        numeralType = 'ordinal';
    } else if (word.isv.endsWith('oje') || word.isv.endsWith('ero')) {
        // Собирательные на -oje/-ero (dvoje, četvero)
        numeralType = 'collective';
    }

    // Сетки итерирования для генератора полной матрицы форм
    const cases = Object.values(Case);
    const numbers = Object.values(NumberType);
    const genders = Object.values(GrammaticalGender);

    // =========================================================================
    // СТРАТЕГИЯ 1: ПОРЯДКОВЫЕ ЧИСЛИТЕЛЬНЫЕ (Склоняются по родам, числам и падежам)
    // =========================================================================
    if (numeralType === 'ordinal') {
        const ordItem: OrdinalDbItem = {
            interslavic: word.isv,
            protoSlavic: word.isv, // Используем лемму как фоллбэк праформы для рендеринга тонов
            paradigm,
            protoStemClass
        };

        for (const num of numbers) {
            for (const gen of genders) {
                for (const cas of cases) {
                    const form = declineOrdinalNumeral({
                        dbItem: ordItem,
                        targetCase: cas,
                        targetNumber: num,
                        targetGender: gen
                    });

                    results.push({
                        surfaceForm: form,
                        feats: { case: cas, number: num, gender: gen.toLowerCase() as any }
                    });
                }
            }
        }
        return results;
    }

    // =========================================================================
    // СТРАТЕГИЯ 2: СОБИРАТЕЛЬНЫЕ ЧИСЛИТЕЛЬНЫЕ (Склоняются только по падежам)
    // =========================================================================
    if (numeralType === 'collective') {
        const collClass: CollectiveClass = word.isv.endsWith('oje') ? 'oje_type' : 'ero_type';
        const collItem: CollectiveDbItem = {
            interslavic: word.isv,
            protoSlavic: word.isv,
            paradigm,
            collClass
        };

        for (const cas of cases) {
            const form = declineCollectiveNumeral({
                dbItem: collItem,
                targetCase: cas
            });

            results.push({
                surfaceForm: form,
                feats: { case: cas, number: NumberType.PLURAL } // Собирательные синтаксически множественны
            });
        }
        return results;
    }

    // =========================================================================
    // СТРАТЕГИЯ 3: КОЛИЧЕСТВЕННЫЕ ЧИСЛИТЕЛЬНЫЕ (Базовые подклассы 1, 2-4, 5-10)
    // =========================================================================
    let numClass: 'one' | 'two_to_four' | 'five_to_ten' = 'five_to_ten';
    if (word.isv === 'edin') numClass = 'one';
    else if (['dva', 'tri', 'četyri', 'četyre'].includes(word.isv)) numClass = 'two_to_four';

    const cardItem: EnhancedNumDbItem = {
        interslavic: word.isv,
        protoSlavic: word.isv,
        paradigm,
        numClass
    };

    if (numClass === 'one') {
        // "Один" имеет полную родо-числовую матрицу формы
        for (const num of numbers) {
            for (const gen of genders) {
                for (const cas of cases) {
                    const form = generateNumeralForm({
                        dbItem: cardItem,
                        targetCase: cas,
                        targetNumber: num,
                        targetGender: gen
                    });
                    results.push({
                        surfaceForm: form,
                        feats: { case: cas, number: num, gender: gen.toLowerCase() as any }
                    });
                }
            }
        }
    } else if (numClass === 'two_to_four') {
        // "Два, три, четыре" согласуются по родам, но не имеют внутренней категории числа (они фиксированы)
        for (const gen of genders) {
            for (const cas of cases) {
                const form = generateNumeralForm({
                    dbItem: cardItem,
                    targetCase: cas,
                    targetNumber: NumberType.PLURAL, // Используется как структурный фоллбэк в коде
                    targetGender: gen
                });
                results.push({
                    surfaceForm: form,
                    feats: { case: cas, gender: gen.toLowerCase() as any }
                });
            }
        }
    } else {
        // "Пять - десять" изменяются строго по падежам (внутри i_basis единственного числа)
        for (const cas of cases) {
            const form = generateNumeralForm({
                dbItem: cardItem,
                targetCase: cas,
                targetNumber: NumberType.SINGULAR
            });
            results.push({
                surfaceForm: form,
                feats: { case: cas, number: NumberType.SINGULAR }
            });
        }
    }

    return results;
}

// =========================================================================
// 1. ПРОЦЕССОР ОПРЕДЕЛИТЕЛЕЙ / МЕСТОИМЕННЫХ ПРИЛАГАТЕЛЬНЫХ (DET)
// =========================================================================
/**
 * Местоименные прилагательные (toy, ves, moy, ktdory) склоняются
 * в точности по адъективно-местоименной сетке (как полные прилагательные).
 */
export function processDeterminer(word: EngineWordInput): GeneratedForm[] {
    if (!word.isv) return [{ surfaceForm: '', feats: {} }];

    const results: GeneratedForm[] = [];
    const paradigm = (word.paradigm as AccentParadigm) || AccentParadigm.A;

    // Большинство определителей исторически восходят к праславянским твердым o-основам
    const dbItem: EnhancedAdjDbItem = {
        interslavic: word.isv,
        protoSlavic: word.isv,
        paradigm,
        protoStemClass: (word.protoStemClass as ProtoStemClass) || ProtoStemClass.O_SHORT
    };

    const cases = Object.values(Case);
    const numbers = Object.values(NumberType);
    const genders = Object.values(GrammaticalGender);

    for (const num of numbers) {
        for (const gen of genders) {
            for (const cas of cases) {
                const form = generateAdjectiveForm({
                    dbItem,
                    targetCase: cas,
                    targetNumber: num,
                    targetGender: gen
                });

                results.push({
                    surfaceForm: form,
                    feats: {
                        case: cas,
                        number: num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du',
                        gender: gen.toLowerCase() as 'masc' | 'fem' | 'neut'
                    }
                });
            }
        }
    }

    return results;
}

// =========================================================================
// 2. ПРОЦЕССОР НАРЕЧИЙ (ADV) С АВТОМАТИЧЕСКИМИ СТЕПЕНЯМИ СРАВНЕНИЯ
// =========================================================================
/**
 * Генерирует качественные наречия в Положительной (pos), Сравнительной (comp)
 * и Превосходной (sup) степенях с правильной праславянской тонировкой.
 */
export function processAdverb(word: EngineWordInput): GeneratedForm[] {
    if (!word.isv) return [{ surfaceForm: '', feats: {} }];
    const lemma = word.isv.toLowerCase().trim();

    const results: GeneratedForm[] = [];
    const { applyFourTonesMark, getAcuteToneType } = require('../numerals/cardinal');

    // Шаг A: Положительная степень (Базовая форма: medlenno, dobro)
    // Наречия на -o/-e получают регулярный акут/гравис на корне основы
    const posForm = applyFourTonesMark(lemma, 1, getAcuteToneType(lemma, 1));
    results.push({ surfaceForm: posForm, feats: { degree: 'pos' } });

    // Проверяем, является ли наречие качественным (может ли в компаратив).
    // Наречия места/времени (н-р: "tam", "včera") степени сравнения игнорируют.
    const isQualitative = lemma.endsWith('o') || lemma.endsWith('ě') || lemma.endsWith('e');

    if (isQualitative && lemma.length > 2) {
        // Шаг Б: Сравнительная степень (Компаратив)
        // Праславянский суффикс *-ěje* (в межславянском: -ěje / -je).
        // Корень очищается от финального наречного гласного
        const cleanBase = lemma.slice(0, -1);

        // Исторически суффикс компаратива *-ě́je* всегда удерживает на себе долгий акут
        const compFormRaw = cleanBase + 'ěje';
        const compForm = applyFourTonesMark(compFormRaw, 1, 'long_acute'); // Всегда ударение на "ě" (medlenně́je)

        results.push({ surfaceForm: compForm, feats: { degree: 'comp' } });

        // Шаг В: Превосходная степень (Суперлатив)
        // Образуется путем добавления безударного праславянского префикса *naj-* к форме компаратива
        const supForm = 'naj' + compForm; // "najmedlenně́je" - акцент сохраняется на суффиксе
        results.push({ surfaceForm: supForm, feats: { degree: 'sup' } });
    }

    return results;
}

// =========================================================================
// 3. ПРОЦЕССОР ВСПОМОГАТЕЛЬНЫХ ГЛАГОЛОВ (AUX)
// =========================================================================
/**
 * Вспомогательные глаголы (byti, daby, nehaj) обеспечивают сборку аналитического
 * синтаксиса. Если это супплетивный глагол "быти", процессор разворачивает его
 * системные таблицы времени из ядра verbEngine.
 */
export function processAuxiliary(word: EngineWordInput): GeneratedForm[] {
    if (!word.isv) return [{ surfaceForm: '', feats: {} }];
    const lemma = word.isv.toLowerCase().trim();

    const results: GeneratedForm[] = [];

    if (lemma === 'byti') {
        // Извлекаем готовые праславянские парадигмы, зафиксированные в verbEngine
        const { bytiPresent, bytiImperfect, bytiFuture, conditionalParticles } = require('../verb/index');

        const pushAux = (paradigm: any, tense: string, mood: string) => {
            Object.keys(paradigm).forEach((key) => {
                results.push({
                    surfaceForm: paradigm[key],
                    feats: {
                        verbForm: 'fin',
                        tense: tense as any,
                        mood: mood as any,
                        person: key.charAt(0) as any,
                        number: key.substring(1) === 'sg' ? 'sg' : key.substring(1) === 'pl' ? 'pl' : 'du'
                    }
                });
            });
        };

        pushAux(bytiPresent, 'pres', 'ind');
        pushAux(bytiFuture, 'fut', 'ind');
        pushAux(bytiImperfect, 'impf', 'ind');
        pushAux(conditionalParticles, 'pres', 'sub'); // Частицы кондиционала (bim, biš)
    } else {
        // Для изолированных частиц сослагательности/императивности (daby, nehaj)
        results.push({
            surfaceForm: lemma,
            feats: { mood: 'sub' }
        });
    }

    return results;
}

// =========================================================================
// 4. ПРОЦЕССОР НЕИЗМЕНЯЕМЫХ СЛОВЕСНЫХ КАТЕГОРИЙ (ADP, CCONJ, PART, INTJ)
// =========================================================================
/**
 * Обслуживает предлоги, союзы, частицы и междометия.
 * Они не имеют флексий, их грамматический атлас feats остается пустым.
 * Знаки препинания и символы полностью разгружаются от диакритики.
 */
export function processUninflected(word: EngineWordInput): GeneratedForm[] {
    if (!word.isv) return [{ surfaceForm: '', feats: {} }];

    // Очищаем от случайных шумов диакритики, если это технический символ или пунктуация
    const surfaceForm = word.pos?.toUpperCase() === 'PUNCT' || word.pos?.toUpperCase() === 'SYM'
        ? word.isv.replace(/[\u0301\u0300\u0302\u0311]/g, '')
        : word.isv;

    return [
        {
            surfaceForm,
            feats: {} // Пустой объект признаков — маркер синтаксического инварианта
        }
    ];
}
