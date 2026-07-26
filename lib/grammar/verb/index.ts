import {
    AccentParadigm
} from "@/lib/grammar/common/paradigm";
import {
    VerbalAspect
} from "@/lib/grammar/common/aspect";
import { getEndingByGrammeme } from '@/lib/grammar/endingLoader';
import { resolveStressOverride } from '@/lib/grammar/stress';

const PRES_GRAMMEME = 'Tense=Pres|VerbForm=Fin';
const AOR_GRAMMEME = 'Tense=Aor|VerbForm=Fin';
const IMPF_GRAMMEME = 'Tense=Impf|VerbForm=Fin';
const IMP_GRAMMEME = 'Mood=Imp|VerbForm=Fin';
const LPART_GRAMMEME = 'Tense=Past|VerbForm=Part';

function verbGrammeme(person: string, number: string, extra: string): string {
  const num = number === 'sg' ? 'Sing' : number === 'du' ? 'Dual' : 'Plur';
  return `Person=${person}|Number=${num}|${extra}`;
}

function getVE(stemType: string, key: string, extra: string, fallback: string): string {
  const person = key.charAt(0);
  const numMarker = key.substring(1);
  return getEndingByGrammeme(stemType, verbGrammeme(person, numMarker, extra)) ?? fallback;
}

function getLPartEnding(gender: string, number: string, fallback: string): string {
  const gn = number === 'sg' ? 'Sing' : number === 'du' ? 'Dual' : 'Plur';
  const g = `Gender=${gender}|Number=${gn}|${LPART_GRAMMEME}`;
  return getEndingByGrammeme('verb_lpart', g) ?? fallback;
}

function getPartEnding(stemType: string, gender: string, number: string, extra: string, fallback: string): string {
  const gn = number === 'sg' ? 'Sing' : number === 'du' ? 'Dual' : 'Plur';
  const g = `Gender=${gender}|Number=${gn}|${extra}`;
  return getEndingByGrammeme(stemType, g) ?? fallback;
}

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
    participles: Participles;
}

export interface Participles {
    presentActive: ParticipleSet;
    presentPassive: ParticipleSet;
    pastPassive: ParticipleSet;
}

export interface ParticipleSet {
    masculine: string;
    feminine: string;
    neuter: string;
    plural: string;
}

export interface VerbModel {
    infinitive: string;
    infStem: string;
    presentStem: string;
    aoristStem: string;
    tertiaryStem?: string;
    verbClass: ProtoSlavicClass;
    aspect: VerbalAspect;
    paradigm: AccentParadigm;
    stressPosition?: number | null;      // Переопределение ударения словом целиком (заимствования)
    morphemes?: { value: string; stressPosition?: number | null }[]; // Переопределение ударным суффиксом/корнем
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

// Сонорные r/l/n перед j палатализуются (r'/l'/ń) без вставки эпентетического l,
// в отличие от губных (p/b/m/v/f + j -> +lj). Подтверждено примерами живого словаря:
// "govoriti" -> govorjut, "galjati" -> galjajut, "obměniti" -> obměnjajut — то есть
// просто "+j", а не "+lj".
const SONORANTS_APPEND_J = ['r', 'l', 'n'];

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
    if (SONORANTS_APPEND_J.includes(lastChar)) return stem + 'j';

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
// 5. ГЕНЕРАТОР ПРИЧАСТИЙ
// =========================================================================

// Ударение причастий — первый проход по аналогии с accentLPart (структурно
// близкая форма: основа + суффикс), не отдельно верифицированная деривация для
// каждого типа причастия. Парадигма A — акут на первом слоге корня; B/C — акут
// на слоге суффикса (тот же паттерн, что уже используется для императива B/C).
function accentParticiple(form: string, paradigm: AccentParadigm, override?: number): string {
    if (paradigm === AccentParadigm.A) {
        return accentSyllable(form, override ?? 'first', 'acute');
    }
    if (paradigm === AccentParadigm.B || paradigm === AccentParadigm.C) {
        return accentSyllable(form, override ?? 1, 'acute');
    }
    return form;
}

export function generateParticiples(verb: VerbModel): Participles {
    const { infinitive, infStem, presentStem, verbClass, paradigm, morphemes, stressPosition } = verb;
    const overrideFor = (form: string) => resolveStressOverride(form, morphemes, stressPosition) ?? undefined;
    const hasThematicE = presentStem.endsWith('e');
    const baseForVowels = hasThematicE ? presentStem.slice(0, -1) : presentStem;

    const PRES_ACT_EXTRA = 'VerbForm=Part|Tense=Pres|Voice=Act';
    const PRES_PASS_EXTRA = 'VerbForm=Part|Tense=Pres|Voice=Pass';
    const PAST_PASS_EXTRA = 'VerbForm=Part|Tense=Past|Voice=Pass';

    let paMasc: string;
    let paFem: string;
    let paNeut: string;
    let paPl: string;
    if (verbClass === 'IV') {
        const iotated = applyIotation(presentStem.slice(0, -1));
        const st = 'verb_part_act_pres_i';
        paMasc = iotated + getPartEnding(st, 'Masc', 'sg', PRES_ACT_EXTRA, 'ęťi');
        paFem = iotated + getPartEnding(st, 'Fem', 'sg', PRES_ACT_EXTRA, 'ęťa');
        paNeut = iotated + getPartEnding(st, 'Neut', 'sg', PRES_ACT_EXTRA, 'ęťe');
        paPl = iotated + getPartEnding(st, 'Masc', 'pl', PRES_ACT_EXTRA, 'ęťi');
    } else {
        const st = 'verb_part_act_pres_th';
        paMasc = baseForVowels + getPartEnding(st, 'Masc', 'sg', PRES_ACT_EXTRA, 'ųšti');
        paFem = baseForVowels + getPartEnding(st, 'Fem', 'sg', PRES_ACT_EXTRA, 'ųťa');
        paNeut = baseForVowels + getPartEnding(st, 'Neut', 'sg', PRES_ACT_EXTRA, 'ųťe');
        paPl = baseForVowels + getPartEnding(st, 'Masc', 'pl', PRES_ACT_EXTRA, 'ųťi');
    }

    let ppm: string;
    let ppf: string;
    let ppn: string;
    let pppl: string;
    if (verbClass === 'IV') {
        const root = presentStem.slice(0, -1);
        const st = 'verb_part_pass_pres_i';
        ppm = root + getPartEnding(st, 'Masc', 'sg', PRES_PASS_EXTRA, 'imyj');
        ppf = root + getPartEnding(st, 'Fem', 'sg', PRES_PASS_EXTRA, 'ima');
        ppn = root + getPartEnding(st, 'Neut', 'sg', PRES_PASS_EXTRA, 'imo');
        pppl = root + getPartEnding(st, 'Masc', 'pl', PRES_PASS_EXTRA, 'ime');
    } else {
        const isJStem = baseForVowels.endsWith('j');
        const st = isJStem ? 'verb_part_pass_pres_e' : 'verb_part_pass_pres_th';
        const fallbackMasc = isJStem ? 'emyj' : 'omyj';
        const fallbackFem = isJStem ? 'ema' : 'oma';
        const fallbackNeut = isJStem ? 'emo' : 'omo';
        const fallbackPl = isJStem ? 'eme' : 'ome';
        ppm = baseForVowels + getPartEnding(st, 'Masc', 'sg', PRES_PASS_EXTRA, fallbackMasc);
        ppf = baseForVowels + getPartEnding(st, 'Fem', 'sg', PRES_PASS_EXTRA, fallbackFem);
        ppn = baseForVowels + getPartEnding(st, 'Neut', 'sg', PRES_PASS_EXTRA, fallbackNeut);
        pppl = baseForVowels + getPartEnding(st, 'Masc', 'pl', PRES_PASS_EXTRA, fallbackPl);
    }

    let ppaMasc: string;
    let ppaStemType: string;
    let ppaFallback: string;
    if (verbClass === 'IV') {
        const root = infStem.slice(0, -1);
        ppaMasc = applyFirstPalatalization(root) + 'enyj';
        ppaStemType = 'verb_part_pass_past_en';
        ppaFallback = 'enyj';
    } else if (verbClass === 'III') {
        ppaMasc = infStem + 'nyj';
        ppaStemType = 'verb_part_pass_past_n';
        ppaFallback = 'nyj';
    } else if (verbClass === 'II') {
        ppaMasc = infStem.slice(0, -1) + 'enyj';
        ppaStemType = 'verb_part_pass_past_en';
        ppaFallback = 'enyj';
    } else {
        const lastChar = infStem.slice(-1);
        if ('aeiouyěęǫ'.includes(lastChar)) {
            ppaMasc = infStem + 'tyj';
            ppaStemType = 'verb_part_pass_past_t';
            ppaFallback = 'tyj';
        } else {
            ppaMasc = applyFirstPalatalization(infStem) + 'enyj';
            ppaStemType = 'verb_part_pass_past_en';
            ppaFallback = 'enyj';
        }
    }
    const ppaFem = ppaMasc.replace('yj', 'a');
    const ppaNeut = ppaMasc.replace('yj', 'o');
    const ppaPl = ppaMasc.replace('yj', 'e');

    return {
        presentActive: {
            masculine: accentParticiple(paMasc, paradigm, overrideFor(paMasc)),
            feminine: accentParticiple(paFem, paradigm, overrideFor(paFem)),
            neuter: accentParticiple(paNeut, paradigm, overrideFor(paNeut)),
            plural: accentParticiple(paPl, paradigm, overrideFor(paPl)),
        },
        presentPassive: {
            masculine: accentParticiple(ppm, paradigm, overrideFor(ppm)),
            feminine: accentParticiple(ppf, paradigm, overrideFor(ppf)),
            neuter: accentParticiple(ppn, paradigm, overrideFor(ppn)),
            plural: accentParticiple(pppl, paradigm, overrideFor(pppl)),
        },
        pastPassive: {
            masculine: accentParticiple(ppaMasc, paradigm, overrideFor(ppaMasc)),
            feminine: accentParticiple(ppaFem, paradigm, overrideFor(ppaFem)),
            neuter: accentParticiple(ppaNeut, paradigm, overrideFor(ppaNeut)),
            plural: accentParticiple(ppaPl, paradigm, overrideFor(ppaPl)),
        },
    };
}

// =========================================================================
// 6. МАТРИЧНЫЙ ГЕНЕРАТОР ПОЛНОГО СПРЯЖЕНИЯ С ЧЕТЫРЕХТОНОВОЙ СИСТЕМОЙ
// =========================================================================

export function conjugateFullVerb(verb: VerbModel): ConjugationResult {
    const { infinitive, infStem, presentStem, aoristStem, tertiaryStem, verbClass, aspect, paradigm, morphemes, stressPosition } = verb;
    const overrideFor = (form: string) => resolveStressOverride(form, morphemes, stressPosition) ?? undefined;

    // --- А. ПРЕЗЕНС (НАСТОЯЩЕЕ / БУДУЩЕЕ ПРЯМОЕ) ---
    const hasThematicE = presentStem.endsWith('e');
    const baseForVowels = hasThematicE ? presentStem.slice(0, -1) : presentStem;

    const presentStemType = verbClass === 'IV' ? 'verb_present_athematic_i' : 'verb_present_thematic_e';

    let p1sg = '';
    if (verbClass === 'IV') {
        const root = presentStem.slice(0, -1);
        p1sg = `${applyIotation(root)}${getVE(presentStemType, '1sg', PRES_GRAMMEME, 'ų')}`;
    } else {
        p1sg = `${baseForVowels}${getVE(presentStemType, '1sg', PRES_GRAMMEME, 'ų')}`;
    }

    const p3pl = verbClass === 'IV'
        ? `${presentStem.slice(0, -1)}${getVE(presentStemType, '3pl', PRES_GRAMMEME, 'ęt')}`
        : `${baseForVowels}${getVE(presentStemType, '3pl', PRES_GRAMMEME, 'ųt')}`;

    const accentPresentForm = (form: string, person: string): string => {
        const override = overrideFor(form);
        if (paradigm === AccentParadigm.A) {
            return accentSyllable(form, override ?? 'first', 'acute');
        }
        if (paradigm === AccentParadigm.B) {
            if (person === '1sg') return accentSyllable(form, override ?? 0, 'short'); // На флексию
            return accentSyllable(form, override ?? 1, 'neoacute'); // Ретракция Шахматова
        }
        if (paradigm === AccentParadigm.C) {
            // Ретракция (закон Дыбо + закон Ившича) даёт новоакут, а не краткий/грав —
            // тот же тип ретракции, что и в парадигме B выше ("Ретракция Шахматова").
            if (person === '1sg') return accentSyllable(form, override ?? 0, 'neoacute');
            return accentSyllable(form, override ?? 'first', 'neoacute'); // Откат на абсолютный первый слог/приставку
        }
        return form;
    };

    const directParadigm: FullParadigm = {
        '1sg': accentPresentForm(p1sg, '1sg'),
        '2sg': accentPresentForm(`${presentStem}${getVE(presentStemType, '2sg', PRES_GRAMMEME, 'š')}`, '2sg'),
        '3sg': accentPresentForm(`${presentStem}${getVE(presentStemType, '3sg', PRES_GRAMMEME, '')}`, '3sg'),
        '1du': accentPresentForm(`${presentStem}${getVE(presentStemType, '1du', PRES_GRAMMEME, 'vě')}`, '1du'),
        '2du': accentPresentForm(`${presentStem}${getVE(presentStemType, '2du', PRES_GRAMMEME, 'ta')}`, '2du'),
        '3du': accentPresentForm(`${presentStem}${getVE(presentStemType, '3du', PRES_GRAMMEME, 'ta')}`, '3du'),
        '1pl': accentPresentForm(`${presentStem}${getVE(presentStemType, '1pl', PRES_GRAMMEME, 'mo')}`, '1pl'),
        '2pl': accentPresentForm(`${presentStem}${getVE(presentStemType, '2pl', PRES_GRAMMEME, 'te')}`, '2pl'),
        '3pl': accentPresentForm(p3pl, '3pl'),
    };

    // --- Б. АОРИСТ ---
    const isVowelStem = ['III', 'IV'].includes(verbClass) || infStem.endsWith('a') || infStem.endsWith('i');

    const accentAoristForm = (form: string, person: string): string => {
        const override = overrideFor(form);
        if (paradigm === AccentParadigm.C && ['2sg', '3sg'].includes(person)) {
            return accentSyllable(form, override ?? 0, 'short'); // Конечное ударение для 2sg/3sg в парадигме C (spasé)
        }
        return accentSyllable(form, override ?? 'first', paradigm === AccentParadigm.A ? 'acute' : 'short');
    };

    const aoristStemType = isVowelStem ? 'verb_aorist_sigmatic' : 'verb_aorist_asigmatic';

    const aorist: FullParadigm = {
        '1sg': accentAoristForm(`${aoristStem}${getVE(aoristStemType, '1sg', AOR_GRAMMEME, 'h')}`, '1sg'),
        '2sg': accentAoristForm(`${aoristStem}${getVE(aoristStemType, '2sg', AOR_GRAMMEME, isVowelStem ? '' : 'e')}`, '2sg'),
        '3sg': accentAoristForm(`${aoristStem}${getVE(aoristStemType, '3sg', AOR_GRAMMEME, isVowelStem ? '' : 'e')}`, '3sg'),
        '1du': accentAoristForm(`${aoristStem}${getVE(aoristStemType, '1du', AOR_GRAMMEME, 'hvě')}`, '1du'),
        '2du': accentAoristForm(`${aoristStem}${getVE(aoristStemType, '2du', AOR_GRAMMEME, 'sta')}`, '2du'),
        '3du': accentAoristForm(`${aoristStem}${getVE(aoristStemType, '3du', AOR_GRAMMEME, 'sta')}`, '3du'),
        '1pl': accentAoristForm(`${aoristStem}${getVE(aoristStemType, '1pl', AOR_GRAMMEME, 'hmo')}`, '1pl'),
        '2pl': accentAoristForm(`${aoristStem}${getVE(aoristStemType, '2pl', AOR_GRAMMEME, 'ste')}`, '2pl'),
        '3pl': accentAoristForm(`${aoristStem}${getVE(aoristStemType, '3pl', AOR_GRAMMEME, 'šę')}`, '3pl'),
    };

    // --- В. ИМПЕРФЕКТ ---
    const impBase = isVowelStem ? infStem : `${infStem}ě`;
    const accentImperfectForm = (form: string) => accentSyllable(form, overrideFor(form) ?? 1, 'circumflex'); // Безусловное ударение на суффикс *-а-

    const imperfect: FullParadigm = {
        '1sg': accentImperfectForm(`${impBase}${getVE('verb_imperfect', '1sg', IMPF_GRAMMEME, 'ah')}`),
        '2sg': accentImperfectForm(`${impBase}${getVE('verb_imperfect', '2sg', IMPF_GRAMMEME, 'aše')}`),
        '3sg': accentImperfectForm(`${impBase}${getVE('verb_imperfect', '3sg', IMPF_GRAMMEME, 'aše')}`),
        '1du': accentImperfectForm(`${impBase}${getVE('verb_imperfect', '1du', IMPF_GRAMMEME, 'ahvě')}`),
        '2du': accentImperfectForm(`${impBase}${getVE('verb_imperfect', '2du', IMPF_GRAMMEME, 'ašeta')}`),
        '3du': accentImperfectForm(`${impBase}${getVE('verb_imperfect', '3du', IMPF_GRAMMEME, 'ašeta')}`),
        '1pl': accentImperfectForm(`${impBase}${getVE('verb_imperfect', '1pl', IMPF_GRAMMEME, 'ahmo')}`),
        '2pl': accentImperfectForm(`${impBase}${getVE('verb_imperfect', '2pl', IMPF_GRAMMEME, 'ašete')}`),
        '3pl': accentImperfectForm(`${impBase}${getVE('verb_imperfect', '3pl', IMPF_GRAMMEME, 'ahu')}`),
    };

    // --- Г. L-ПРИЧАСТИЕ (ОСНОВА ДЛЯ ПЕРФЕКТА/КОНДИЦИОНАЛА) ---
    const accentLPart = (form: string, gender: 'm' | 'f' | 'n' | 'pl') => {
        const override = overrideFor(form);
        if (paradigm === AccentParadigm.C && gender === 'f') {
            return accentSyllable(form, override ?? 0, 'short'); // Смещение на флексию женского рода в мобильном типе (neslá)
        }
        return accentSyllable(form, override ?? 'first', paradigm === AccentParadigm.A ? 'acute' : 'short');
    };

    const lStem = tertiaryStem || infStem;
    const lParticiple: LParticiple = {
        masculine: accentLPart(`${lStem}${getLPartEnding('Masc', 'sg', 'l')}`, 'm'),
        feminine: accentLPart(`${lStem}${getLPartEnding('Fem', 'sg', 'la')}`, 'f'),
        neuter: accentLPart(`${lStem}${getLPartEnding('Neut', 'sg', 'lo')}`, 'n'),
        dual_masculine: accentLPart(`${lStem}${getLPartEnding('Masc', 'du', 'la')}`, 'pl'),
        dual_feminine_neuter: accentLPart(`${lStem}${getLPartEnding('Fem', 'du', 'lě')}`, 'pl'),
        plural_masculine: accentLPart(`${lStem}${getLPartEnding('Masc', 'pl', 'li')}`, 'pl'),
        plural_feminine_neuter: accentLPart(`${lStem}${getLPartEnding('Fem', 'pl', 'le')}`, 'pl'),
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

    // --- Е. ПРИЧАСТИЯ ---
    const participles = generateParticiples(verb);

    // --- Ж. ИМПЕРАТИВ ---
    let impBaseForm = '';
    if (verbClass === 'IV') {
        impBaseForm = `${presentStem}`;
    } else {
        const rootWithoutE = hasThematicE ? presentStem.slice(0, -1) : presentStem;
        impBaseForm = rootWithoutE.endsWith('j') ? rootWithoutE : `${rootWithoutE}j`;
    }

    const accentImperative = (form: string) => {
        const override = overrideFor(form);
        if (paradigm === AccentParadigm.A) return accentSyllable(form, override ?? 'first', 'acute');
        return accentSyllable(form, override ?? 1, 'acute'); // Суффикс императива *-i-/-j-* под ударением для B и C (xvalí!)
    };

    const imperative: ImperativeParadigm = {
        '2sg': accentImperative(impBaseForm),
        '1du': accentImperative(`${impBaseForm}${getVE('verb_imperative', '1du', IMP_GRAMMEME, 'vě')}`),
        '2du': accentImperative(`${impBaseForm}${getVE('verb_imperative', '2du', IMP_GRAMMEME, 'ta')}`),
        '1pl': accentImperative(`${impBaseForm}${getVE('verb_imperative', '1pl', IMP_GRAMMEME, 'mo')}`),
        '2pl': accentImperative(`${impBaseForm}${getVE('verb_imperative', '2pl', IMP_GRAMMEME, 'te')}`),
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
        participles,
    };
}
