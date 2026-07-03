import {
    AccentParadigm
} from "@/lib/grammar/common/paradigm";
import {
    VerbalAspect
} from "@/lib/grammar/common/aspect";

// =========================================================================
// 1. СТРОГИЕ ИНТЕРФЕЙСЫ И ТИПЫ ДАННЫХ
// =========================================================================

export type AccentType = 'acute' | 'circumflex' | 'neoacute' | 'short';
export type ProtoSlavicClass = 'I' | 'II' | 'III' | 'IV' | 'V';

export interface FullParadigm {
    '1sg': string; '2sg': string; '3sg': string;
    '1du': string; '2du': string; '3du': string;
    '1pl': string; '2pl': string; '3pl': string;
}

export interface ImperativeParadigm {
    '2sg': string;
    '1du': string; '2du': string;
    '1pl': string; '2pl': string;
}

export interface LParticiple {
    masculine: string;
    feminine: string;
    neuter: string;
    dual_masculine: string;
    dual_feminine_neuter: string;
    plural_masculine: string;
    plural_feminine_neuter: string;
}

export interface IndicativeMood {
    presentOrFutureDirect: FullParadigm;
    futureAnalytical?: {
        withByti: FullParadigm;
        withImati: FullParadigm;
        withHtěti: FullParadigm;
    };
    aorist: FullParadigm;
    imperfect: FullParadigm;
    perfect: {
        masculine: FullParadigm;
        feminine: FullParadigm;
        neuter: FullParadigm;
        plural: FullParadigm;
    };
    pluperfect: {
        masculine: FullParadigm;
        feminine: FullParadigm;
    };
}

export interface ConjugationResult {
    infinitive: string;
    verbClass: ProtoSlavicClass;
    aspect: VerbalAspect;
    lParticiple: LParticiple;
    indicative: IndicativeMood;
    imperative: ImperativeParadigm;
    conditional: {
        masculine: FullParadigm;
        feminine: FullParadigm;
    };
}

export interface VerbModel {
    infinitive: string;
    infStem: string;
    presentStem: string;
    aoristStem: string;
    verbClass: ProtoSlavicClass;
    aspect: VerbalAspect;
    paradigm: AccentParadigm; // Извлечено напрямую из метаданных таблицы Word
}

export interface ExtractedStems {
    infStem: string;
    presentStem: string;
    aoristStem: string;
    verbClass: ProtoSlavicClass;
}

// =========================================================================
// 2. ВСПОМОГАТЕЛЬНЫЕ КОНСТАНТЫ СУППЛЕТИВНОЙ АТЕМАТИКИ ("БЫТИ")
// =========================================================================

export const bytiPresent: FullParadigm = {
    '1sg': 'jesm',  '2sg': 'jesi',  '3sg': 'jest',
    '1du': 'jesvě', '2du': 'jesta', '3du': 'jesta',
    '1pl': 'jesmo', '2pl': 'jeste', '3pl': 'sųt'
};

export const bytiImperfect: FullParadigm = {
    '1sg': 'běh',   '2sg': 'běše',  '3sg': 'běše',
    '1du': 'běhvě', '2du': 'běšeta', '3du': 'běšeta',
    '1pl': 'běhmo', '2pl': 'běšete', '3pl': 'běhų'
};

export const bytiFuture: FullParadigm = {
    '1sg': 'bųdų',   '2sg': 'bųdeš',  '3sg': 'bųde',
    '1du': 'bųdevě', '2du': 'bųdeta', '3du': 'bųdeta',
    '1pl': 'bųdemo', '2pl': 'bųdete', '3pl': 'bųdųt'
};

export const conditionalParticles: FullParadigm = {
    '1sg': 'bim',   '2sg': 'biš',   '3sg': 'bi',
    '1du': 'bivě',  '2du': 'bita',  '3du': 'bita',
    '1pl': 'bimo',  '2pl': 'bite',  '3pl': 'bišę'
};

const FIRST_PALATALIZATION: Record<string, string> = {
    'k': 'č', 'g': 'ž', 'h': 'š', 'ch': 'š'
};

const IOTATION: Record<string, string> = {
    't': 'č', 'd': 'ž', 's': 'š', 'z': 'ž', 'k': 'č', 'g': 'ž', 'h': 'š', 'ch': 'š', 'c': 'č'
};

const LABIALS = ['p', 'b', 'm', 'v', 'f'];

// =========================================================================
// 3. НИЗКОУРОВНЕВЫЙ ДВИЖОК ЗВУКОВЫХ ЧЕРЕДОВАНИЙ И ДИАКРИТИКИ
// =========================================================================

export function applyFirstPalatalization(stem: string): string {
    if (stem.endsWith('ch')) return stem.slice(0, -2) + 'š';
    const lastChar = stem.slice(-1);
    if (lastChar in FIRST_PALATALIZATION) {
        return stem.slice(0, -1) + FIRST_PALATALIZATION[lastChar];
    }
    return stem;
}

export function applyIotation(stem: string): string {
    if (stem.endsWith('st')) return stem.slice(0, -2) + 'šč';
    if (stem.endsWith('zd')) return stem.slice(0, -2) + 'ždž';
    if (stem.endsWith('sk')) return stem.slice(0, -2) + 'šč';
    if (stem.endsWith('zg')) return stem.slice(0, -2) + 'ždž';

    const lastChar = stem.slice(-1);
    if (LABIALS.includes(lastChar)) return stem + 'lj';

    if (lastChar in IOTATION) {
        return stem.slice(0, -1) + IOTATION[lastChar];
    }
    return stem;
}

export function applySpecificAccent(word: string, syllableIndex: number, type: AccentType): string {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(word.matchAll(vowels));
    if (matches.length === 0) return word;

    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;
    const char = word[targetIndex];

    let accentMark = '\u0301';
    switch (type) {
        case 'acute':
        case 'neoacute':     accentMark = '\u0301'; break; // ́
        case 'circumflex':   accentMark = '\u0302'; break; // ̂
        case 'short':        accentMark = '\u0300'; break; // ̀
    }

    return word.substring(0, targetIndex) + char + accentMark + word.substring(targetIndex + 1);
}

function accentSyllable(word: string, position: number | 'first', tone: AccentType): string {
    if (position === 'first') {
        const vowels = /[aeiouyěęǫọų]/gi;
        const matches = Array.from(word.matchAll(vowels));
        if (matches.length === 0) return word;

        const firstSyllableIndex = matches.length - 1;
        return applySpecificAccent(word, firstSyllableIndex, tone);
    }
    return applySpecificAccent(word, position, tone);
}

// =========================================================================
// 4. ВОССТАНОВЛЕНИЕ ОСНОВ ПО ЛЕСКИНУ С УЧЕТОМ ПАЛАТАЛИЗАЦИИ
// =========================================================================

export function extractProtoStems(infinitive: string): ExtractedStems {
    const lemma = infinitive.toLowerCase().trim();

    if (lemma.endsWith('iti') && lemma.length > 5) {
        const root = lemma.slice(0, -3);
        return { infStem: root + 'i', presentStem: root + 'i', aoristStem: root + 'i', verbClass: 'IV' };
    }
    if (lemma.endsWith('ovati')) {
        const root = lemma.slice(0, -5);
        return { infStem: root + 'ova', presentStem: root + 'uje', aoristStem: root + 'ova', verbClass: 'III' };
    }
    if (lemma.endsWith('ati')) {
        const root = lemma.slice(0, -3);
        return { infStem: root + 'a', presentStem: root + 'aje', aoristStem: root + 'a', verbClass: 'III' };
    }
    if (lemma.endsWith('nųti') || lemma.endsWith('nuti')) {
        const suffix = lemma.endsWith('nųti') ? 'nų' : 'nu';
        const root = lemma.slice(0, -4);
        return { infStem: root + suffix, presentStem: root + 'ne', aoristStem: root + suffix, verbClass: 'II' };
    }

    const rawRoot = lemma.slice(0, -2);
    const palatalizedRoot = applyFirstPalatalization(rawRoot);
    return { infStem: rawRoot, presentStem: palatalizedRoot + 'e', aoristStem: rawRoot, verbClass: 'I' };
}

// =========================================================================
// 5. МАТРИЧНЫЙ ГЕНЕРАТОР ПОЛНОГО СПРЯЖЕНИЯ С ЧЕТЫРЕХТОНОВОЙ СИСТЕМОЙ
// =========================================================================

export function conjugateFullVerb(verb: VerbModel): ConjugationResult {
    const { infinitive, infStem, presentStem, aoristStem, verbClass, aspect, paradigm } = verb;

    // --- А. ПРЕЗЕНС (НАСТОЯЩЕЕ / БУДУЩЕЕ ПРЯМОЕ) ---
    const hasThematicE = presentStem.endsWith('e');
    const baseForVowels = hasThematicE ? presentStem.slice(0, -1) : presentStem;

    let p1sg = '';
    if (verbClass === 'IV') {
        const root = presentStem.slice(0, -1);
        p1sg = `${applyIotation(root)}ų`;
    } else {
        p1sg = `${baseForVowels}ų`;
    }

    const p3pl = verbClass === 'IV'
        ? `${presentStem.slice(0, -1)}ęt`
        : `${baseForVowels}ųt`;

    const accentPresentForm = (form: string, person: string): string => {
        if (paradigm === AccentParadigm.A) {
            return accentSyllable(form, 'first', 'acute');
        }
        if (paradigm === AccentParadigm.B) {
            if (person === '1sg') return accentSyllable(form, 0, 'short'); // На флексию
            return accentSyllable(form, 1, 'neoacute'); // Ретракция Шахматова
        }
        if (paradigm === AccentParadigm.C) {
            if (person === '1sg') return accentSyllable(form, 0, 'short');
            return accentSyllable(form, 'first', 'short'); // Откат на абсолютный первый слог/приставку
        }
        return form;
    };

    const directParadigm: FullParadigm = {
        '1sg': accentPresentForm(p1sg, '1sg'),
        '2sg': accentPresentForm(`${presentStem}š`, '2sg'),
        '3sg': accentPresentForm(`${presentStem}`, '3sg'),
        '1du': accentPresentForm(`${presentStem}vě`, '1du'),
        '2du': accentPresentForm(`${presentStem}ta`, '2du'),
        '3du': accentPresentForm(`${presentStem}ta`, '3du'),
        '1pl': accentPresentForm(`${presentStem}mo`, '1pl'),
        '2pl': accentPresentForm(`${presentStem}te`, '2pl'),
        '3pl': accentPresentForm(p3pl, '3pl'),
    };

    // --- Б. АОРИСТ ---
    const isVowelStem = ['III', 'IV'].includes(verbClass) || infStem.endsWith('a') || infStem.endsWith('i');

    const accentAoristForm = (form: string, person: string): string => {
        if (paradigm === AccentParadigm.C && ['2sg', '3sg'].includes(person)) {
            return accentSyllable(form, 0, 'short'); // Конечное ударение для 2sg/3sg в парадигме C (spasé)
        }
        return accentSyllable(form, 'first', paradigm === AccentParadigm.A ? 'acute' : 'short');
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

    // --- В. ИМПЕРФЕКТ ---
    const impBase = isVowelStem ? infStem : `${infStem}ě`;
    const accentImperfectForm = (form: string) => accentSyllable(form, 1, 'circumflex'); // Безусловное ударение на суффикс *-а-

    const imperfect: FullParadigm = {
        '1sg': accentImperfectForm(`${impBase}ah`),     '2sg': accentImperfectForm(`${impBase}aše`),    '3sg': accentImperfectForm(`${impBase}aše`),
        '1du': accentImperfectForm(`${impBase}ahvě`),   '2du': accentImperfectForm(`${impBase}ašeta`),  '3du': accentImperfectForm(`${impBase}ašeta`),
        '1pl': accentImperfectForm(`${impBase}ahmo`),   '2pl': accentImperfectForm(`${impBase}ašete`),  '3pl': accentImperfectForm(`${impBase}ahu`),
    };

    // --- Г. L-ПРИЧАСТИЕ (ОСНОВА ДЛЯ ПЕРФЕКТА/КОНДИЦИОНАЛА) ---
    const accentLPart = (form: string, gender: 'm' | 'f' | 'n' | 'pl') => {
        if (paradigm === AccentParadigm.C && gender === 'f') {
            return accentSyllable(form, 0, 'short'); // Смещение на флексию женского рода в мобильном типе (neslá)
        }
        return accentSyllable(form, 'first', paradigm === AccentParadigm.A ? 'acute' : 'short');
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

    // --- Д. СБОРКА АНАЛИТИЧЕСКИХ СВЯЗОК ---
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
    if (aspect === VerbalAspect.IPF || aspect === VerbalAspect.BI) {
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

    // --- Е. ИМПЕРАТИВ ---
    let impBaseForm = '';
    if (verbClass === 'IV') {
        impBaseForm = `${presentStem}`;
    } else {
        const rootWithoutE = hasThematicE ? presentStem.slice(0, -1) : presentStem;
        impBaseForm = rootWithoutE.endsWith('j') ? rootWithoutE : `${rootWithoutE}j`;
    }

    const accentImperative = (form: string) => {
        if (paradigm === AccentParadigm.A) return accentSyllable(form, 'first', 'acute');
        return accentSyllable(form, 1, 'acute'); // Суффикс императива *-i-/-j-* под ударением для B и C (xvalí!)
    };

    const imperative: ImperativeParadigm = {
        '2sg': accentImperative(impBaseForm),
        '1du': accentImperative(`${impBaseForm}vě`),
        '2du': accentImperative(`${impBaseForm}ta`),
        '1pl': accentImperative(`${impBaseForm}mo`),
        '2pl': accentImperative(`${impBaseForm}te`),
    };

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
    };
}
