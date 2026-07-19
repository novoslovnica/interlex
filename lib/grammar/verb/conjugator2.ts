import {VerbModel, ConjugationResult, FullParadigm, LParticiple, IndicativeMood, Participles, ParticipleSet} from './types/conjugator';
import {applyIotation} from "@/lib/grammar/morphonology";
import {applyFirstPalatalization} from "@/lib/grammar/verb/index";
import {bytiFuture, bytiImperfect, bytiPresent, conditionalParticles} from "@/lib/grammar/verb/auxiliary";
import {applySpecificAccent} from "@/lib/grammar/accentUtils";

// Вспомогательный хелпер (замените на вашу функцию разметки слогов и тонов)
// syllableFromEnd: 0 - последний слог, 1 - предпоследний, 'first' - абсолютное начало слова
function accentSyllable(word: string, position: number | 'first', tone: 'acute' | 'circumflex' | 'neoacute' | 'short'): string {
    if (position === 'first') {
        // Чтобы зафиксировать ударение на самом первом слоге,
        // syllableIndex должен быть равен общему количеству слогов минус 1.
        const vowels = /[aeiouyěęǫọų]/gi;
        const matches = Array.from(word.matchAll(vowels));
        if (matches.length === 0) return word;

        const firstSyllableIndex = matches.length - 1;
        return applySpecificAccent(word, firstSyllableIndex, tone);
    }

    // Если передан обычный индекс с конца (0, 1), пробрасываем напрямую
    return applySpecificAccent(word, position, tone);
}

function generateParticiples(verb: VerbModel): Participles {
    const { infinitive, infStem, presentStem, verbClass } = verb;
    const hasThematicE = presentStem.endsWith('e');
    const baseForVowels = hasThematicE ? presentStem.slice(0, -1) : presentStem;

    // --- Present Active Participle (-ǫšti / -ęťi) ---
    let paBase: string;
    let paMasc: string;
    let paFem: string;
    let paNeut: string;
    let paPl: string;
    if (verbClass === 'IV') {
        const iotated = applyIotation(presentStem.slice(0, -1));
        paBase = iotated;
        paMasc = iotated + 'ęťi';
        paFem = iotated + 'ęťa';
        paNeut = iotated + 'ęťe';
        paPl = iotated + 'ęťi';
    } else {
        paMasc = baseForVowels + 'ǫšti';
        paFem = baseForVowels + 'ǫťa';
        paNeut = baseForVowels + 'ǫťe';
        paPl = baseForVowels + 'ǫťi';
    }

    // --- Present Passive Participle (-omyj / -imyj) ---
    let ppm: string;
    let ppf: string;
    let ppn: string;
    let ppp: string;
    if (verbClass === 'IV') {
        const root = presentStem.slice(0, -1);
        ppm = root + 'imyj';
        ppf = root + 'ima';
        ppn = root + 'imo';
        ppp = root + 'ime';
    } else {
        const suffix = baseForVowels.endsWith('j') ? 'emyj' : 'omyj';
        ppm = baseForVowels + suffix;
        ppf = baseForVowels + suffix.replace('yj', 'a');
        ppn = baseForVowels + suffix.replace('yj', 'o');
        ppp = baseForVowels + suffix.replace('yj', 'e');
    }

    // --- Past Passive Participle (-enyj / -tyj / -nyj) ---
    let ppaMasc: string;
    if (verbClass === 'IV') {
        const root = infStem.slice(0, -1);
        ppaMasc = applyFirstPalatalization(root) + 'enyj';
    } else if (verbClass === 'III') {
        ppaMasc = infStem + 'nyj';
    } else if (verbClass === 'II') {
        ppaMasc = infStem.slice(0, -1) + 'enyj';
    } else {
        const lastChar = infStem.slice(-1);
        if ('aeiouyěęǫ'.includes(lastChar)) {
            ppaMasc = infStem + 'tyj';
        } else {
            ppaMasc = applyFirstPalatalization(infStem) + 'enyj';
        }
    }
    const ppaFem = ppaMasc.replace('yj', 'a');
    const ppaNeut = ppaMasc.replace('yj', 'o');
    const ppaPl = ppaMasc.replace('yj', 'e');

    return {
        presentActive: { masculine: paMasc, feminine: paFem, neuter: paNeut, plural: paPl },
        presentPassive: { masculine: ppm, feminine: ppf, neuter: ppn, plural: ppp },
        pastPassive: { masculine: ppaMasc, feminine: ppaFem, neuter: ppaNeut, plural: ppaPl },
    };
}

export function conjugateFullVerb(verb: VerbModel): ConjugationResult {
    const { infinitive, infStem, presentStem, aoristStem, verbClass, aspect, paradigm } = verb; // TODO: вытащить из БД парадигму

    // --- 1. Презенс (Настоящее / Бесприставочное будущее время) ---
    const hasThematicE = presentStem.endsWith('e');
    const baseForVowels = hasThematicE ? presentStem.slice(0, -1) : presentStem;

    // 1sg форма
    let p1sg = '';
    if (verbClass === 'IV') {
        const root = presentStem.slice(0, -1);
        p1sg = `${applyIotation(root)}ų`;
    } else {
        p1sg = `${baseForVowels}ų`;
    }

    // 3pl форма
    const p3pl = verbClass === 'IV'
        ? `${presentStem.slice(0, -1)}ęt`
        : `${baseForVowels}ųt`;

    // Применяем правила распределения ударения для Презенса:
    // Парадигма А: Ударение стационарно на корне (обычно акут или старый долгий тон на первом слоге)
    // Парадигма B: В 1sg ударение на флексии (-ų́), в остальных формах — неоакут на последнем слоге корня (ретракция Шахматова)
    // Парадигма C: В 1sg ударение на флексии (-ų́), в остальных формах — на абсолютном первом слоге слова (энклитический тип)

    // Применяем правила распределения ударения для Презенса (Настоящего времени):
    // Парадигма А: Ударение стационарно на первом/главном слоге корня во всех формах.
    // Парадигма B: В 1sg ударение на флексии (-ų́), в остальных формах — ретракция на последний слог корня.
    // Парадигма C: В 1sg ударение на флексии (-ų́), в остальных формах — уходит на абсолютное начало слова.

    const accentPresentForm = (
        form: string,
        person: '1sg' | '2sg' | '3sg' | '1du' | '2du' | '3du' | '1pl' | '2pl' | '3pl'
    ): string => {
        if (paradigm === 'A') {
            return accentSyllable(form, 'first', 'acute');
        }

        if (paradigm === 'B') {
            if (person === '1sg') {
                return accentSyllable(form, 0, 'short'); // на окончание -ų
            }
            if (person === '3pl') {
                return accentSyllable(form, 1, 'neoacute'); // ретракция на слог перед -ųt
            }
            // Для 2sg, 3sg, 1pl, 2pl, 1du, 2du, 3du — откат на последний слог основы (перед тематическим гласным/окончанием)
            return accentSyllable(form, 1, 'neoacute');
        }

        if (paradigm === 'C') {
            if (person === '1sg') {
                return accentSyllable(form, 0, 'short'); // на окончание -ų
            }
            // Во всех остальных лицах парадигмы C ударение падает строго на самый первый слог слова
            return accentSyllable(form, 'first', 'short');
        }

        return form;
    };

    const directParadigm: FullParadigm = {
        // Единственное
        '1sg': accentPresentForm(p1sg, '1sg'),
        '2sg': accentPresentForm(`${presentStem}š`, '2sg'),
        '3sg': accentPresentForm(`${presentStem}`, '3sg'),

        // Двойственное
        '1du': accentPresentForm(`${presentStem}vě`, '1du'),
        '2du': accentPresentForm(`${presentStem}ta`, '2du'),
        '3du': accentPresentForm(`${presentStem}ta`, '3du'),

        // Множественное
        '1pl': accentPresentForm(`${presentStem}mo`, '1pl'),
        '2pl': accentPresentForm(`${presentStem}te`, '2pl'),
        '3pl': accentPresentForm(p3pl, '3pl'),
    };



    // --- 2. Аорист ---
    // В аористе праславянские парадигмы вели себя иначе, чем в презенсе:
    // Парадигмы А и B обычно удерживали ударение на корне/суффиксе аориста (баритонеза)
    // Парадигма С уходила в тотальную подвижность: в 1-х лицах и 3pl — на корень, а в 2sg/3sg — на окончание
    const isVowelStem = ['III', 'IV'].includes(verbClass) || infStem.endsWith('a') || infStem.endsWith('i');

    const accentAoristForm = (form: string, persons: '1sg'|'2sg'|'3sg'|'1du'|'2du'|'3du'|'1pl'|'2pl'|'3pl'): string => {
        if (paradigm === 'C' && ['2sg', '3sg'].includes(persons)) {
            // В парадигме C формы 2sg/3sg (напр. "спасé") получают конечное ударение
            return accentSyllable(form, 0, 'short');
        }
        // В остальных случаях стандартное корневое или суффиксальное ударение основы
        return accentSyllable(form, 'first', paradigm === 'A' ? 'acute' : 'short');
    };

    const aorist: FullParadigm = {
        '1sg': accentAoristForm(`${aoristStem}h`, '1sg'),
        '2sg': accentAoristForm(isVowelStem ? `${aoristStem}` : `${aoristStem}e`, '2sg'),
        '3sg': accentAoristForm(isVowelStem ? `${aoristStem}` : `${aoristStem}e`, '3sg'),
        '1du': accentAoristForm(`${aoristStem}hvě`, '1du'),
        '2du': accentAoristForm(`${aoristStem}sta`, '2du'),
        '3du': accentAoristForm(`${aoristStem}sta`, '3du'),
        '1pl': accentAoristForm(`${aoristStem}hmo`, '1pl'),
        '2pl': accentAoristForm(`${aoristStem}ste`, '2pl'),
        '3pl': accentAoristForm(`${aoristStem}šę`, '3pl'),
    };


    // --- 3. Имперфект ---
    // В имперфекте суффикс *-ах-* всегда перетягивал на себя циркумфлексное или долгое ударение во всех парадигмах
    const impBase = isVowelStem ? infStem : `${infStem}ě`;
    const accentImperfectForm = (form: string) => accentSyllable(form, 1, 'circumflex'); // Ударный суффикс -а-

    const imperfect: FullParadigm = {
        '1sg': accentImperfectForm(`${impBase}ah`),     '2sg': accentImperfectForm(`${impBase}aše`),    '3sg': accentImperfectForm(`${impBase}aše`),
        '1du': accentImperfectForm(`${impBase}ahvě`),   '2du': accentImperfectForm(`${impBase}ašeta`),  '3du': accentImperfectForm(`${impBase}ašeta`),
        '1pl': accentImperfectForm(`${impBase}ahmo`),   '2pl': accentImperfectForm(`${impBase}ašete`),  '3pl': accentImperfectForm(`${impBase}ahu`),
    };


    // --- 4. Генерация L-причастия (Основа для Перфекта/Кондиционала) ---
    // Причастие на -л отражает парадигму основы:
    // Парадигма А: строго на корне (*dě́lalъ)
    // Парадигма B: на суффиксе перед -л (*hvalílı)
    // Парадигма C: подвижное (м.р. на корне, ж.р. уходит на флексию: *neslí, но *neslá)
    const accentLPart = (form: string, gender: 'm' | 'f' | 'n' | 'pl') => {
        if (paradigm === 'C' && gender === 'f') {
            return accentSyllable(form, 0, 'short'); // уход на окончание -ла
        }
        return accentSyllable(form, 'first', paradigm === 'A' ? 'acute' : 'short');
    };

    const lParticiple: LParticiple = {
        masculine: accentLPart(`${infStem}l`, 'm'),
        feminine: accentLPart(`${infStem}la`, 'f'),
        neuter: accentLPart(`${infStem}lo`, 'n'),
        dual_masculine: accentLPart(`${infStem}la`, 'pl'),
        dual_feminine_neuter: accentLPart(`${infStem}lě`, 'pl'),
        plural_masculine: accentLPart(`${infStem}li`, 'pl'),
        plural_feminine_neuter: accentLPart(`${infStem}le`, 'pl'),
    };

    // --- Оставшаяся часть сборки аналитических форм (без изменений структуры) ---
    const buildAnalytical = (aux: FullParadigm, part: string): FullParadigm => {
        const res = {} as FullParadigm;
        (Object.keys(aux) as Array<keyof FullParadigm>).forEach((key) => {
            res[key] = `${aux[key]} ${part}`;
        });
        return res;
    };

    const perfect = {
        masculine: buildAnalytical(bytiPresent, lParticiple.masculine),
        feminine: buildAnalytical(bytiPresent, lParticiple.feminine),
        neuter: buildAnalytical(bytiPresent, lParticiple.neuter),
        plural: buildAnalytical(bytiPresent, lParticiple.plural_masculine),
    };

    const pluperfect = {
        masculine: buildAnalytical(bytiImperfect, lParticiple.masculine),
        feminine: buildAnalytical(bytiImperfect, lParticiple.feminine),
    };

    let futureAnalytical: IndicativeMood['futureAnalytical'];
    if (aspect === 'imperfective' || aspect === 'bi-aspectual') {
        futureAnalytical = {
            withByti: buildAnalytical(bytiFuture, infinitive),
            withImati: buildAnalytical({
                '1sg': 'imam', '2sg': 'imaš', '3sg': 'ima', '1du': 'imavě', '2du': 'imata', '3du': 'imata', '1pl': 'imamo', '2pl': 'imate', '3pl': 'imajųt'
            }, infinitive),
            withHtěti: buildAnalytical({
                '1sg': 'hoćų', '2sg': 'hočeš', '3sg': 'hoče', '1du': 'hočevě', '2du': 'hočeta', '3du': 'hočeta', '1pl': 'hočemo', '2pl': 'hočete', '3pl': 'hočųt'
            }, infinitive),
        };
    }

    // --- 5. Императив ---
    // В императиве праславянский суффикс *-и-/-й-* всегда под ударением в парадигмах B и C (напр. *xvalí!*, *nesí!*)
    let impBaseForm = '';
    if (verbClass === 'IV') {
        impBaseForm = `${presentStem}`;
    } else {
        const rootWithoutE = hasThematicE ? presentStem.slice(0, -1) : presentStem;
        impBaseForm = rootWithoutE.endsWith('j') ? rootWithoutE : `${rootWithoutE}j`;
    }

    const accentImperative = (form: string) => {
        if (paradigm === 'A') return accentSyllable(form, 'first', 'acute');
        return accentSyllable(form, 1, 'acute'); // Суффикс императива под ударением для B и C
    };

    const imperative = {
        '2sg': accentImperative(impBaseForm),
        '1du': accentImperative(`${impBaseForm}vě`),
        '2du': accentImperative(`${impBaseForm}ta`),
        '1pl': accentImperative(`${impBaseForm}mo`),
        '2pl': accentImperative(`${impBaseForm}te`),
    };

    const participles = generateParticiples(verb);

    const conditional = {
        masculine: buildAnalytical(conditionalParticles, lParticiple.masculine),
        feminine: buildAnalytical(conditionalParticles, lParticiple.feminine),
    };

    return {
        infinitive,
        verbClass,
        aspect,
        lParticiple,
        indicative: {
            presentOrFutureDirect: directParadigm,
            futureAnalytical,
            aorist,
            imperfect,
            perfect,
            pluperfect,
        },
        imperative,
        conditional,
        participles,
    };
}
