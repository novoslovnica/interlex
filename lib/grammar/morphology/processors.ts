import { EngineWordInput, GeneratedForm, MorphoGrammarFeats } from '@/lib/grammar/morphology';
import {
    GrammaticalGender,
    GrammaticalCase,
    GrammaticalNumber,
    AccentParadigm,
    ProtoStemClass,
    VerbalAspect,
    AdjectiveTypeClass,
} from '@/lib/grammar/common';
// Импортируем изолированные движки трех классов числительных
import { generateNumeralForm, EnhancedNumDbItem, applyFourTonesMark, getAcuteToneType } from '../numerals/cardinal';
import { declineOrdinalNumeral, OrdinalDbItem } from '../numerals/ordinal';
import { declineCollectiveNumeral, CollectiveDbItem, CollectiveClass } from '../numerals/collective';
import { ALL_CASES, ALL_NUMBERS, NumberType } from '../endingsRegistry';
import { declineWordAutomatically, declineModernPluralVariants, declineIStemInstrumentalVariant, asNStemIfMisfiled } from '../declineNoun';
import { EnhancedDbItem, resolveGender } from '../stemClassifier';
import {
    conjugateFullVerb,
    buildVerbModel,
    VerbModel,
    FullParadigm,
    bytiPresent,
    bytiImperfect,
    bytiFuture,
    conditionalParticles
} from '../verb';
import { splitMechanicalVerbTail, appendTailToConjugation } from '../verb/mechanicalTail';
import { generateAdjectiveForm, EnhancedAdjDbItem, classifyAdjectiveType, adjectiveEnding } from '../adjective';
import { generatePronounForm, generatePronounForms, classifyPronoun, canonicalPronounLemma, EnhancedPronounDbItem, PronounAnalysis, PronounClass } from '../pronoun';
import { getEndingByGrammeme } from '@/lib/grammar/endingLoader';

/**
 * Процессор Существительных (NOUN)
 * Генерирует полный массив падежных и числовых словоформ с расчетом 4 праславянских тонов.
 */
export function processNoun(word: EngineWordInput): GeneratedForm[] {
    if (!word.isv) {
        return [{ surfaceForm: '', feats: {} }];
    }

    const results: GeneratedForm[] = [];

    // 1. Безопасно приводим сырые метаданные из Word — используем ту же нормализацию
    // рода (resolveGender), что и реальная страница слова (app/words/[id]/page.tsx),
    // поэтому регистр/формат gender из БД ('Masc'/'MASC'/'masculine') не имеет значения.
    // Так же, как и страница слова, предпочитаем "голый" корень (word.stem) словарной
    // форме (word.isv) — getEnding() сам добавляет падежное окончание к корню, и если
    // подать вместо корня уже готовую словарную форму (у которой это окончание уже
    // есть, напр. "selo" для среднего рода), окончание наложится второй раз ("seloo").
    const dbItem: EnhancedDbItem = asNStemIfMisfiled({
        interslavic: word.stem || word.isv,
        protoSlavic: word.isv, // Используем лемму как фоллбэк для расчета вокалических ядер
        paradigm: (word.paradigm as 'A' | 'B' | 'C') || 'A',
        gender: resolveGender(word.gender, word.protoStemClass ?? undefined),
        protoStemClass: word.protoStemClass || 'o',
        stemExtension: word.stemExtension || undefined,
        animacy: word.animacy || undefined,
        stressPosition: word.stressPosition,
        morphemes: word.morphemes,
    });

    // 2. Разворачиваем полную матрицу форм (7 падежей * 3 числа = 21 словоформа)
    const cases = ALL_CASES as GrammaticalCase[];
    const numbers = ALL_NUMBERS;

    const genderFeat = (dbItem.gender === 'masculine' ? 'Masc' : dbItem.gender === 'feminine' ? 'Fem' : 'Neut') as GrammaticalGender;

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
                    case: cas, // short UD codes since 2026-08-12: 'nom' | 'gen' | ...
                    number: (num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du') as GrammaticalNumber,
                    gender: genderFeat
                }
            });
        }
    }

    // Дальше — формы для распознавания рядом с основными. Все помечены variant:
    // находят лексему, но не перебивают другие лексемы как буквальные совпадения.
    const numberFeat = (num: NumberType) =>
        (num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du') as GrammaticalNumber;
    const pushVariant = (surfaceForm: string, cas: GrammaticalCase, number: GrammaticalNumber) => {
        results.push({ surfaceForm, feats: { case: cas, number, gender: genderFeat }, variant: true });
    };

    // Современные окончания множественного числа (-ov/-am/-ami/-ah), см. declineModernPluralVariants.
    for (const { targetCase, form } of declineModernPluralVariants(dbItem, word.flavor)) {
        pushVariant(form, targetCase as GrammaticalCase, 'pl' as GrammaticalNumber);
    }

    // Творительный ед. i-основ на -ju (pomočju, čestju), см. declineIStemInstrumentalVariant.
    const iStemInstrumental = declineIStemInstrumentalVariant(dbItem);
    if (iStemInstrumental) pushVariant(iStemInstrumental, 'ins' as GrammaticalCase, 'sg' as GrammaticalNumber);

    // Склонение по соседнему классу основы, которое живёт в корпусе:
    // - s-основы (slovo/sloves-, nebo/nebes-) без наращения: slov (2 747), slovami, slovu;
    // - u-основы (syn, dom) как o-основы: syna (189), synom, domu, doma;
    // - мягкие основы на c с твёрдыми окончаниями: kirilicy (99) рядом с kirilicę.
    // Формы собственного класса остаются, эти добавляются.
    const psc = String(dbItem.protoStemClass).toLowerCase();
    const isSStem = psc === 'consonant' && String(dbItem.stemExtension).toLowerCase() === 'es';
    const isUStem = psc === 'u';
    const isSoftCStem = (psc === 'jo' || psc === 'jā') && dbItem.interslavic.endsWith('c');
    if (isSStem || isUStem || isSoftCStem) {
        const regularItem: EnhancedDbItem = { ...dbItem, protoStemClass: psc === 'jā' ? 'ā' : 'o', stemExtension: undefined };
        for (const num of numbers) {
            for (const cas of cases) {
                pushVariant(declineWordAutomatically({ dbItem: regularItem, targetCase: cas, targetNumber: num, flavor: word.flavor }), cas, numberFeat(num));
            }
        }
        for (const { targetCase, form } of declineModernPluralVariants(regularItem, word.flavor)) {
            pushVariant(form, targetCase as GrammaticalCase, 'pl' as GrammaticalNumber);
        }
    }

    return results;
}

/**
 * Все формы местоимения, кроме личных ja/ty (у них своя ветка в processPronoun,
 * с энклитиками): местоименные прилагательные, on, sebe, семейство kto/čto и
 * неизменяемые. Одна клетка может дать несколько написаний (česo/čego,
 * jemu/njemu) — распознаваться должны все. Используется и для jedin (NUM).
 */
function generatePronounParadigm(word: EngineWordInput, lemma: string, analysis: PronounAnalysis): GeneratedForm[] {
    const paradigm = (word.paradigm as AccentParadigm) || (lemma === 'on' ? AccentParadigm.C : AccentParadigm.A);
    const dbItem: EnhancedPronounDbItem = {
        interslavic: lemma,
        protoSlavic: lemma,
        paradigm,
        pronClass: analysis.pronClass,
        stressPosition: word.stressPosition,
        morphemes: word.morphemes,
    };
    const results: GeneratedForm[] = [];
    const seen = new Set<string>();
    const push = (surfaceForm: string, feats: MorphoGrammarFeats) => {
        const key = `${surfaceForm}|${feats.case}|${feats.number}|${feats.gender}`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push({ surfaceForm, feats });
    };
    const numberFeat = (num: NumberType) =>
        (num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du') as GrammaticalNumber;
    const cases = ALL_CASES as GrammaticalCase[];

    if (analysis.pronClass === 'anaphoric' || analysis.pronClass === 'pronominal') {
        const genders = Object.values(GrammaticalGender) as GrammaticalGender[];
        for (const num of ALL_NUMBERS) {
            for (const gen of genders) {
                for (const cas of cases) {
                    for (const form of generatePronounForms({ dbItem, targetCase: cas, targetNumber: num, targetGender: gen })) {
                        push(form, { case: cas, number: numberFeat(num), gender: gen });
                    }
                }
            }
        }
        return results;
    }

    const numbers = analysis.onlyNumber ? [analysis.onlyNumber] : [NumberType.SINGULAR];
    for (const num of numbers) {
        for (const cas of cases) {
            for (const isEnclitic of [false, true]) {
                for (const form of generatePronounForms({ dbItem, targetCase: cas, targetNumber: num, isEnclitic })) {
                    push(form, { case: cas, number: numberFeat(num) });
                }
            }
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
        const number = (numMarker === 'sg' ? 'sg' : numMarker === 'pl' ? 'pl' : 'du') as GrammaticalNumber;

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

    // 0. Механический хвост: "глагол + sę/se" и/или "глагол + известный предлог"
    // (напр. "zaruciti se", "bazovati na", "bazovati se na") — регулярно
    // спрягаемая конструкция, а не идиома. Спрягаем только голову (verbHead),
    // неизменяемый хвост приклеиваем в конце ко всем сгенерированным формам
    // через appendTailToConjugation. Лексемы, где хвост НЕ распознан как
    // механический, помечаются Lexeme.isCollocation и сюда вообще не доходят
    // (гейт в engine.ts).
    const { head: verbHead, tailSuffix } = splitMechanicalVerbTail(word.isv, word.knownPrepositions ?? []);

    // Лексема VERB, чья словарная форма — не инфинитив ("je, jest" — формы byti,
    // заведённые отдельной статьёй), не спрягается: правила вывели бы из "je"
    // обрывки "e", "i", "h", "l", и союз "i" стал бы омонимом глагола.
    if (!/(ti|ť|či|ći)$/.test(verbHead.toLowerCase().trim())) {
        return [{ surfaceForm: word.isv, feats: {} }];
    }

    // 1-3. Модель глагола: канонический инфинитив (value часто без диакритики —
    // "uciti" при стеме "uči"), основы из лексемы и класс. См. buildVerbModel.
    const verbModel: VerbModel = buildVerbModel({
        head: verbHead,
        stem: word.stem,
        secondaryStem: word.secondaryStem,
        tertiaryStem: word.tertiaryStem,
        aspect: (word.aspect as VerbalAspect) || VerbalAspect.IPF,
        paradigm: (word.paradigm as AccentParadigm) || AccentParadigm.A,
        stressPosition: word.stressPosition,
        morphemes: word.morphemes,
    });

    // Сам инфинитив как базовая форма
    results.push({
        surfaceForm: verbModel.infinitive + tailSuffix,
        feats: { verbForm: 'inf' }
    });

    // 4. Запускаем генерацию полной глагольной матрицы
    const conj = appendTailToConjugation(conjugateFullVerb(verbModel), tailSuffix);

    // 5. Плоское уплотнение (Flattening) результатов с заполнением грамматического атласа feats

    // А. Настоящее / Будущее простое время (Презенс)
    pushParadigmToResults(results, conj.indicative.presentOrFutureDirect, {
        verbForm: 'fin',
        tense: verbModel.aspect === VerbalAspect.PF ? 'fut' : 'pres',
        mood: 'ind'
    });

    // А2. Краткая парадигма настоящего времени глаголов на -ati
    // (znam/znaš/zna рядом с znajų/znaješ/znaje) — в ISV живут обе, и в
    // корпусе встречаются обе, поэтому распознаваться должны обе. Признаки
    // те же, что у полной: это то же самое время того же глагола, другой
    // ряд окончаний.
    if (conj.indicative.presentOrFutureDirectShort) {
        pushParadigmToResults(results, conj.indicative.presentOrFutureDirectShort, {
            verbForm: 'fin',
            tense: verbModel.aspect === VerbalAspect.PF ? 'fut' : 'pres',
            mood: 'ind'
        });
    }

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
        const number = (numMarker === 'sg' ? 'sg' : numMarker === 'pl' ? 'pl' : 'du') as GrammaticalNumber;

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
        { surfaceForm: lp.masculine, feats: { verbForm: 'part', gender: 'Masc' as GrammaticalGender, number: 'sg' as GrammaticalNumber, tense: 'past' } },
        { surfaceForm: lp.feminine, feats: { verbForm: 'part', gender: 'Fem' as GrammaticalGender, number: 'sg' as GrammaticalNumber, tense: 'past' } },
        { surfaceForm: lp.neuter, feats: { verbForm: 'part', gender: 'Neut' as GrammaticalGender, number: 'sg' as GrammaticalNumber, tense: 'past' } },
        { surfaceForm: lp.plural_masculine, feats: { verbForm: 'part', gender: 'Masc' as GrammaticalGender, number: 'pl' as GrammaticalNumber, tense: 'past' } },
        { surfaceForm: lp.plural_feminine_neuter, feats: { verbForm: 'part', gender: 'Fem' as GrammaticalGender, number: 'pl' as GrammaticalNumber, tense: 'past' } },
        { surfaceForm: lp.dual_masculine, feats: { verbForm: 'part', gender: 'Masc' as GrammaticalGender, number: 'du' as GrammaticalNumber, tense: 'past' } },
        { surfaceForm: lp.dual_feminine_neuter, feats: { verbForm: 'part', gender: 'Fem' as GrammaticalGender, number: 'du' as GrammaticalNumber, tense: 'past' } }
    );

    // Е. Причастия: активные настоящего времени (-ǫšti/-ęťi)
    const pa = conj.participles.presentActive;
    results.push(
        { surfaceForm: pa.masculine, feats: { verbForm: 'part', gender: 'Masc' as GrammaticalGender, number: 'sg' as GrammaticalNumber, tense: 'pres', voice: 'act' } },
        { surfaceForm: pa.feminine, feats: { verbForm: 'part', gender: 'Fem' as GrammaticalGender, number: 'sg' as GrammaticalNumber, tense: 'pres', voice: 'act' } },
        { surfaceForm: pa.neuter, feats: { verbForm: 'part', gender: 'Neut' as GrammaticalGender, number: 'sg' as GrammaticalNumber, tense: 'pres', voice: 'act' } },
        { surfaceForm: pa.plural, feats: { verbForm: 'part', gender: 'Masc' as GrammaticalGender, number: 'pl' as GrammaticalNumber, tense: 'pres', voice: 'act' } },
    );

    // Ж. Причастия: пассивные настоящего времени (-omyj/-imyj)
    const pp = conj.participles.presentPassive;
    results.push(
        { surfaceForm: pp.masculine, feats: { verbForm: 'part', gender: 'Masc' as GrammaticalGender, number: 'sg' as GrammaticalNumber, tense: 'pres', voice: 'pass' } },
        { surfaceForm: pp.feminine, feats: { verbForm: 'part', gender: 'Fem' as GrammaticalGender, number: 'sg' as GrammaticalNumber, tense: 'pres', voice: 'pass' } },
        { surfaceForm: pp.neuter, feats: { verbForm: 'part', gender: 'Neut' as GrammaticalGender, number: 'sg' as GrammaticalNumber, tense: 'pres', voice: 'pass' } },
        { surfaceForm: pp.plural, feats: { verbForm: 'part', gender: 'Masc' as GrammaticalGender, number: 'pl' as GrammaticalNumber, tense: 'pres', voice: 'pass' } },
    );

    // З. Причастия: пассивные прошедшего времени (-enyj/-tyj/-nyj)
    const ppa = conj.participles.pastPassive;
    results.push(
        { surfaceForm: ppa.masculine, feats: { verbForm: 'part', gender: 'Masc' as GrammaticalGender, number: 'sg' as GrammaticalNumber, tense: 'past', voice: 'pass' } },
        { surfaceForm: ppa.feminine, feats: { verbForm: 'part', gender: 'Fem' as GrammaticalGender, number: 'sg' as GrammaticalNumber, tense: 'past', voice: 'pass' } },
        { surfaceForm: ppa.neuter, feats: { verbForm: 'part', gender: 'Neut' as GrammaticalGender, number: 'sg' as GrammaticalNumber, tense: 'past', voice: 'pass' } },
        { surfaceForm: ppa.plural, feats: { verbForm: 'part', gender: 'Masc' as GrammaticalGender, number: 'pl' as GrammaticalNumber, tense: 'past', voice: 'pass' } },
    );

    // Л. Причастия склоняются как прилагательные: в корпусе slědujučih, stvorjenyh,
    // napisanoj, govorečih. Выше — по одной форме на род (как на странице слова),
    // здесь — полная сетка. Действительные настоящего — мягкие (govoreči,
    // govorečego), страдательные — твёрдые (napisany, napisanogo), у страдательного
    // прошедшего есть и краткая форма мужского рода (dozvoljen — 452, napisan).
    const accentMarks = /[̀́̂̑]/g;
    const pushDeclinedParticiple = (masculine: string, soft: boolean, baseFeats: MorphoGrammarFeats, shortMasculine: boolean) => {
        const bare = (tailSuffix && masculine.endsWith(tailSuffix) ? masculine.slice(0, -tailSuffix.length) : masculine)
            .replace(accentMarks, '');
        const stem = bare.slice(0, -1);
        const genders = Object.values(GrammaticalGender) as GrammaticalGender[];
        for (const num of ALL_NUMBERS) {
            const number = (num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du') as GrammaticalNumber;
            for (const gen of genders) {
                for (const cas of ALL_CASES as GrammaticalCase[]) {
                    results.push({
                        surfaceForm: stem + adjectiveEnding(soft, num, cas, gen) + tailSuffix,
                        feats: { ...baseFeats, case: cas, number, gender: gen },
                    });
                }
            }
        }
        if (shortMasculine) {
            results.push({
                surfaceForm: stem + tailSuffix,
                feats: { ...baseFeats, number: 'sg' as GrammaticalNumber, gender: GrammaticalGender.MASC },
            });
        }
    };
    pushDeclinedParticiple(conj.participles.presentActive.masculine, true, { verbForm: 'part', tense: 'pres', voice: 'act' }, false);
    pushDeclinedParticiple(conj.participles.presentPassive.masculine, false, { verbForm: 'part', tense: 'pres', voice: 'pass' }, false);
    pushDeclinedParticiple(conj.participles.pastPassive.masculine, false, { verbForm: 'part', tense: 'past', voice: 'pass' }, true);

    // М. Действительное прошедшего на -vši (byvši 86, viděvši 18, sdělavši 7) —
    // от основы инфинитива на гласный.
    if (/[aeiouyěęųå]$/.test(verbModel.infStem)) {
        results.push({
            surfaceForm: `${verbModel.infStem}vši${tailSuffix}`,
            feats: { verbForm: 'part', tense: 'past', voice: 'act' },
        });
    }

    // И. byti: будущее (bųdų/bųdeš/bųdųt) и частицы условного наклонения
    // (byh/bys/by/byhmo/byste). Их порождал только processAuxiliary, а byti в
    // словаре — VERB, поэтому budut (2 720), budeš, byh (3 635) не распознавались.
    if (verbModel.infinitive === 'byti') {
        pushParadigmToResults(results, bytiFuture, { verbForm: 'fin', tense: 'fut', mood: 'ind' });
        pushParadigmToResults(results, conditionalParticles, { verbForm: 'fin', mood: 'sub' });
    }

    // К. -čati/-žati/-šati/-jati без записанной основы настоящего: многие из них
    // спрягаются по IV классу (zvučati/zvuči, kričati/kriči, stojati/stoji), но
    // не все (slušati/slušaje) — поэтому IV-презенс добавляется вариантом.
    if (!word.secondaryStem && /[čžšj]ati$/.test(verbModel.infinitive)) {
        const iStemModel: VerbModel = { ...verbModel, presentStem: verbModel.infinitive.slice(0, -3) + 'i', verbClass: 'IV' };
        const iConj = appendTailToConjugation(conjugateFullVerb(iStemModel), tailSuffix);
        pushParadigmToResults(results, iConj.indicative.presentOrFutureDirect, {
            verbForm: 'fin',
            tense: verbModel.aspect === VerbalAspect.PF ? 'fut' : 'pres',
            mood: 'ind',
        });
    }

    // У вспомогательных и модальных глаголов (iměti, mogti, htěti) страдательных
    // причастий нет, а порождённые "iměn/iměna/iměni" перехватывали формы
    // существительного imę (imena, imenom). iměti/byti/hotěti/věděti заведены и
    // как VERB — для них то же самое.
    const NO_PASSIVE_PARTICIPLES = new Set(['iměti', 'imeti', 'byti', 'hotěti', 'hoteti', 'htěti', 'hteti', 'věděti', 'vedeti']);
    const withoutPassives = word.pos?.toUpperCase() === 'AUX' || NO_PASSIVE_PARTICIPLES.has(verbModel.infinitive)
        ? results.filter((form) => !(form.feats.verbForm === 'part' && form.feats.voice === 'pass'))
        : results;

    // Н. Краткое 1 л. мн. без -o: možem (345 в корпусе), budem (174), hčem (162)
    // рядом с možemo/budemo/hčemo. Та же форма бывает и 1 л. ед. (idem, pišem),
    // поэтому она пишется с обоими признаками — выбор остаётся за контекстом.
    // Форма на -mo не заменяется, краткая добавляется рядом.
    const accentMarkChars = /[̀́̂̑]/g;
    const shortFirstPlural: GeneratedForm[] = [];
    for (const form of withoutPassives) {
        const f = form.feats;
        if (f.verbForm !== 'fin' || f.mood !== 'ind' || f.person !== '1' || f.number !== 'pl') continue;
        if (f.tense !== 'pres' && f.tense !== 'fut') continue;
        const bare = form.surfaceForm.replace(accentMarkChars, '');
        const head = tailSuffix && bare.endsWith(tailSuffix) ? bare.slice(0, -tailSuffix.length) : bare;
        if (!head.endsWith('mo') || head.includes(' ')) continue;
        const shortForm = head.slice(0, -1) + tailSuffix;
        shortFirstPlural.push(
            { surfaceForm: shortForm, feats: { ...f }, variant: true },
            { surfaceForm: shortForm, feats: { ...f, number: 'sg' as GrammaticalNumber }, variant: true },
        );
    }
    const finalResults = [...withoutPassives, ...shortFirstPlural];

    // О. Возвратный или предложный хвост в тексте — отдельный токен: "pojavil se"
    // приходит как "pojavil" + "se". Все формы были с приклеенным хвостом, и ни
    // одна не совпадала с токеном (pojavila, pojavil, pojavili, zavisi — сотни
    // вхождений в очереди). Формы без хвоста добавляются рядом, с хвостом остаются.
    if (!tailSuffix) return finalResults;
    const withoutTail = finalResults
        .filter((form) => form.surfaceForm.endsWith(tailSuffix))
        .map((form) => ({ ...form, surfaceForm: form.surfaceForm.slice(0, -tailSuffix.length), variant: true }));
    return [...finalResults, ...withoutTail];
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

    // Каноническая словарная форма: value часто без диакритики ("nasy"), а стем
    // с ней ("naš") — тогда форма собирается из стема и окончания value.
    const adjLemma = (() => {
        const value = word.isv.toLowerCase().trim();
        const stem = (word.stem ?? '').toLowerCase().trim();
        const withEnding = stem + value.slice(-1);
        return stem && withEnding !== value && canonicalPronounLemma(value, withEnding) === withEnding ? withEnding : word.isv;
    })();

    // Детекшн типа прилагательного — единая функция, см. lib/grammar/adjective/index.ts
    const adjClass: AdjectiveTypeClass = classifyAdjectiveType(adjLemma);

    const dbItem: EnhancedAdjDbItem = {
        interslavic: adjLemma,
        protoSlavic: adjLemma,
        paradigm,
        protoStemClass,
        adjClass,
        stressPosition: word.stressPosition,
        morphemes: word.morphemes,
    };

    const cases = ALL_CASES as GrammaticalCase[];
    const numbers = ALL_NUMBERS;
    const genders = Object.values(GrammaticalGender) as GrammaticalGender[];

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
                            number: (num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du') as GrammaticalNumber,
                            gender: gen,
                            degree: deg // Напрямую пишем 'pos' | 'comp' | 'sup' в аналитический атлас
                        }
                    });
                }
            }
        }
    }

    // Прилагательные с основой на шипящую, c или j (naš, vaš, pěšy) в корпусе
    // склоняются мягко: našego (303), našej (419), našem. В словаре у таких основ
    // часто нет признака jo, и они шли по твёрдому склонению — мягкие формы
    // добавляются вариантами, твёрдые остаются.
    const adjBase = adjLemma.slice(0, -1);
    if (/(?:[čšžcjćđľťďńśź]|dž|šč)$/.test(adjBase) && protoStemClass !== ProtoStemClass.JO_SHORT) {
        const softItem: EnhancedAdjDbItem = { ...dbItem, protoStemClass: ProtoStemClass.JO_SHORT, interslavic: adjBase + 'i' };
        for (const num of numbers) {
            for (const gen of genders) {
                for (const cas of cases) {
                    results.push({
                        surfaceForm: generateAdjectiveForm({ dbItem: softItem, targetCase: cas, targetNumber: num, targetGender: gen }),
                        feats: {
                            case: cas,
                            number: (num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du') as GrammaticalNumber,
                            gender: gen,
                            degree: 'pos',
                        },
                        variant: true,
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

    // Лемма — каноническое написание (см. canonicalPronounLemma): по value "cto"
    // классификатор не узнал бы даже čto.
    const lemma = canonicalPronounLemma(word.isv, word.stem);
    const analysis = classifyPronoun(lemma);
    if (analysis.pronClass !== 'personal' || analysis.onlyNumber) {
        return generatePronounParadigm(word, lemma, analysis);
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
        pronClass,
        stressPosition: word.stressPosition,
        morphemes: word.morphemes,
    };

    const cases = ALL_CASES as GrammaticalCase[];
    const numbers = ALL_NUMBERS;
    const genders = Object.values(GrammaticalGender) as GrammaticalGender[];

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
                        number: (num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du') as GrammaticalNumber,
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
                            number: (num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du') as GrammaticalNumber,
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
                        number: 'sg' as GrammaticalNumber,
                        gender: gen
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

    // jedin/jeden склоняется как местоименное прилагательное (jednogo, jednu,
    // jednoj), а не по сетке "edin" ниже, которая до словарного "jedin" не
    // доходила и выдавала "jedinj"/"jedinejų".
    const numeralLemma = canonicalPronounLemma(word.isv, word.stem);
    const asPronoun = classifyPronoun(numeralLemma);
    // Только семейство с кратким именительным: порядковые на -y (pęty) классификатор
    // тоже считает местоименными, но у них своя, уже рабочая ветка ниже.
    if (asPronoun.pronClass === 'pronominal' && asPronoun.pronominal?.shortMasc) {
        return generatePronounParadigm(word, numeralLemma, asPronoun);
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
    const cases = ALL_CASES as GrammaticalCase[];
    const numbers = ALL_NUMBERS;
    const genders = Object.values(GrammaticalGender) as GrammaticalGender[];

    // =========================================================================
    // СТРАТЕГИЯ 1: ПОРЯДКОВЫЕ ЧИСЛИТЕЛЬНЫЕ (Склоняются по родам, числам и падежам)
    // =========================================================================
    if (numeralType === 'ordinal') {
        const ordItem: OrdinalDbItem = {
            interslavic: word.isv,
            protoSlavic: word.isv, // Используем лемму как фоллбэк праформы для рендеринга тонов
            paradigm,
            protoStemClass,
            stressPosition: word.stressPosition,
            morphemes: word.morphemes,
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
                        feats: { case: cas, number: (num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du') as GrammaticalNumber, gender: gen }
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
            collClass,
            stressPosition: word.stressPosition,
            morphemes: word.morphemes,
        };

        for (const cas of cases) {
            const form = declineCollectiveNumeral({
                dbItem: collItem,
                targetCase: cas
            });

            results.push({
                surfaceForm: form,
                feats: { case: cas, number: 'pl' as GrammaticalNumber } // Собирательные синтаксически множественны
            });
        }
        return results;
    }

    // =========================================================================
    // СТРАТЕГИЯ 3: КОЛИЧЕСТВЕННЫЕ ЧИСЛИТЕЛЬНЫЕ (Базовые подклассы 1, 2-4, 5-10)
    // =========================================================================
    let numClass: 'one' | 'two_to_four' | 'five_to_ten' = 'five_to_ten';
    if (numeralLemma === 'edin') numClass = 'one';
    else if (['dva', 'tri', 'četyri', 'četyre'].includes(numeralLemma)) numClass = 'two_to_four';

    // Косвенные падежи 2-4 в современном ISV: dvoh/dvom/dvoma, trěh/trěm/trěmi,
    // četyrěh/četyrěm/četyrmi. Сетка ниже даёт двойственные dvoju/dvyma, а в
    // корпусе dvoh — 749, dvoma — 222. Добавляются вариантами.
    const TWO_TO_FOUR_OBLIQUE: Record<string, [string, string][]> = {
        dva: [['dvoh', 'gen'], ['dvoh', 'loc'], ['dvom', 'dat'], ['dvoma', 'ins'], ['dvoma', 'dat']],
        tri: [['trěh', 'gen'], ['trěh', 'loc'], ['trěm', 'dat'], ['trěmi', 'ins']],
        četyri: [['četyrěh', 'gen'], ['četyrěh', 'loc'], ['četyrěm', 'dat'], ['četyrmi', 'ins']],
    };
    for (const [form, cas] of TWO_TO_FOUR_OBLIQUE[numeralLemma] ?? []) {
        results.push({ surfaceForm: form, feats: { case: cas as GrammaticalCase } });
    }

    const cardItem: EnhancedNumDbItem = {
        interslavic: word.isv,
        protoSlavic: word.isv,
        paradigm,
        numClass,
        stressPosition: word.stressPosition,
        morphemes: word.morphemes,
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
                        feats: { case: cas, number: (num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du') as GrammaticalNumber, gender: gen }
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
                    feats: { case: cas, gender: gen }
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
                feats: { case: cas, number: 'sg' as GrammaticalNumber }
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
        protoStemClass: (word.protoStemClass as ProtoStemClass) || ProtoStemClass.O_SHORT,
        stressPosition: word.stressPosition,
        morphemes: word.morphemes,
    };

    const cases = ALL_CASES as GrammaticalCase[];
    const numbers = ALL_NUMBERS;
    const genders = Object.values(GrammaticalGender) as GrammaticalGender[];

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
                        number: (num === NumberType.SINGULAR ? 'sg' : num === NumberType.PLURAL ? 'pl' : 'du') as GrammaticalNumber,
                        gender: gen
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

    const posForm = applyFourTonesMark(lemma, 1, getAcuteToneType(lemma, 1));
    results.push({ surfaceForm: posForm, feats: { degree: 'pos' } });

    const isQualitative = lemma.endsWith('o') || lemma.endsWith('ě') || lemma.endsWith('e');

    if (isQualitative && lemma.length > 2) {
        const cleanBase = lemma.slice(0, -1);

        const compSuffix = getEndingByGrammeme('adverb_comp', 'Degree=Cmp') ?? 'ěje';
        const supPrefix = getEndingByGrammeme('adverb_sup', 'Degree=Sup') ?? 'naj';

        const compFormRaw = cleanBase + compSuffix;
        const compForm = applyFourTonesMark(compFormRaw, 1, 'long_acute');
        results.push({ surfaceForm: compForm, feats: { degree: 'comp' } });

        const supForm = supPrefix + compForm;
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
        const pushAux = (paradigm: any, tense: string, mood: string) => {
            Object.keys(paradigm).forEach((key) => {
                results.push({
                    surfaceForm: paradigm[key],
                    feats: {
                        verbForm: 'fin',
                        tense: tense as any,
                        mood: mood as any,
                        person: key.charAt(0) as any,
                        number: (key.substring(1) === 'sg' ? 'sg' : key.substring(1) === 'pl' ? 'pl' : 'du') as GrammaticalNumber
                    }
                });
            });
        };

        pushAux(bytiPresent, 'pres', 'ind');
        pushAux(bytiFuture, 'fut', 'ind');
        pushAux(bytiImperfect, 'impf', 'ind');
        pushAux(conditionalParticles, 'pres', 'sub'); // Частицы кондиционала (byh, bys, by)
    } else if (lemma.endsWith('ti')) {
        // Модальные и прочие AUX-глаголы (mogti, htěti, iměti, uměti, morati) по форме
        // обычные глаголы и спрягаются полностью. Раньше отдавалась только словарная
        // форма, и mogu/možeš/mogut (8 000+ вхождений) не распознавались.
        return processVerb(word);
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
