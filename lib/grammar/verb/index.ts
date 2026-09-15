import {
    AccentParadigm
} from "@/lib/grammar/common/paradigm";
import {
    VerbalAspect
} from "@/lib/grammar/common/aspect";
import { getEndingByGrammeme } from '@/lib/grammar/endingLoader';
import { resolveStressOverride } from '@/lib/grammar/stress';
import { foldDiacritics } from '@/lib/corpus/tokenizer/foldDiacritics';

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
    // Краткая («стяжённая») парадигма настоящего времени глаголов на -ati:
    // znam/znaš/zna/znamo/znate/znajut рядом с znajų/znaješ/znaje. В ISV
    // существуют обе, поэтому движок порождает обе — признака у лексемы нет
    // (подтверждено мейнтейнером 2026-08-24: краткую берут все глаголы на
    // -ati). Отсутствует у остальных классов спряжения.
    presentOrFutureDirectShort?: FullParadigm;
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

// Частицы условного наклонения. Были старославянскими (bim/biš/bi/bimo/bite/
// bišę) — в корпусе этих форм практически нет (biš: 2), тогда как byh — 3 635,
// bys — 535, byhmo — 419, byste — 344, by — 10 000+.
export const conditionalParticles: FullParadigm = {
    '1sg': 'byh',   '2sg': 'bys',   '3sg': 'by',
    '1du': 'byhvě', '2du': 'bysta', '3du': 'bysta',
    '1pl': 'byhmo', '2pl': 'byste', '3pl': 'by'
};

// Нерегулярные (атематические и супплетивные) презенсы. Правилами их не
// вывести: dati — dam/dadųt, věděti — věm/vědųt, iměti — imam/imajųt. У
// hotěti в корпусе живы два ряда: hoču/hočeš (901/587) и hču/hčeš (1 320/1 014).
// Ключ — инфинитив; приставочные глаголы (prodati, odpověděti) берут ту же сетку.
const IRREGULAR_PRESENTS: Record<string, FullParadigm[]> = {
    byti: [bytiPresent],
    dati: [{
        '1sg': 'dam', '2sg': 'daš', '3sg': 'da', '1du': 'davě', '2du': 'data', '3du': 'data',
        '1pl': 'damo', '2pl': 'date', '3pl': 'dadųt',
    }],
    jesti: [{
        '1sg': 'jem', '2sg': 'ješ', '3sg': 'je', '1du': 'jevě', '2du': 'jeta', '3du': 'jeta',
        '1pl': 'jemo', '2pl': 'jete', '3pl': 'jedųt',
    }],
    věděti: [{
        '1sg': 'věm', '2sg': 'věš', '3sg': 'vě', '1du': 'věvě', '2du': 'věta', '3du': 'věta',
        '1pl': 'věmo', '2pl': 'věte', '3pl': 'vědųt',
    }],
    iměti: [{
        '1sg': 'imam', '2sg': 'imaš', '3sg': 'ima', '1du': 'imavě', '2du': 'imata', '3du': 'imata',
        '1pl': 'imamo', '2pl': 'imate', '3pl': 'imajųt',
    }],
    hotěti: [{
        '1sg': 'hočų', '2sg': 'hočeš', '3sg': 'hoče', '1du': 'hočevě', '2du': 'hočeta', '3du': 'hočeta',
        '1pl': 'hočemo', '2pl': 'hočete', '3pl': 'hočųt',
    }, {
        '1sg': 'hčų', '2sg': 'hčeš', '3sg': 'hče', '1du': 'hčevě', '2du': 'hčeta', '3du': 'hčeta',
        '1pl': 'hčemo', '2pl': 'hčete', '3pl': 'hčųt',
    }],
};
IRREGULAR_PRESENTS['htěti'] = IRREGULAR_PRESENTS['hotěti'];

const VERBAL_PREFIXES = new Set([
    '', 'do', 'iz', 'na', 'nad', 'o', 'ob', 'od', 'po', 'pod', 'pre', 'prě', 'pred', 'prěd',
    'pri', 'pro', 'raz', 's', 'sȯ', 'so', 'u', 'v', 'vȯ', 'vo', 'vy', 'za',
]);

const FIRST_PALATALIZATION: Record<string, string> = {
    'k': 'č', 'g': 'ž', 'h': 'š', 'ch': 'š'
};

// d + j даёт dž (vidžu, hodžu), а не старославянское ž: в корпусе vidžu — 1 515,
// vižu — 35.
const IOTATION: Record<string, string> = {
    't': 'č', 'd': 'dž', 's': 'š', 'z': 'ž', 'k': 'č', 'g': 'ž', 'h': 'š', 'ch': 'š', 'c': 'č'
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

// -ěti: чаще всего IV класс с презенсом на -i- (viděti/vidi, letěti/leti,
// zavisěti/zavisi). На -ěje- — uměti (с razuměti) и spěti.
// Сравнивается со свёрнутой леммой, поэтому без ě.
const JE_CLASS_ETI = /(umeti|speti)$/;
const FINAL_VOWEL = /[aeiouyěęųå]$/;

export function extractProtoStems(infinitive: string): ExtractedStems {
    const lemma = infinitive.toLowerCase().trim();

    // Корень минимум из двух букв: učiti — IV класс (uči), а piti/biti/šiti —
    // односложные основы на гласный с презенсом на -je- (pije), см. ниже.
    // Прежний порог длины > 5 отправлял и učiti туда же.
    if (lemma.endsWith('iti') && lemma.length >= 5) {
        const root = lemma.slice(0, -3);
        return { infStem: root + 'i', presentStem: root + 'i', aoristStem: root + 'i', verbClass: 'IV' };
    }
    // Без диакритики "-eti" почти всегда то же -ěti ("zaviseti", "videti"):
    // настоящих глаголов на -eti в ISV единицы. Гласная сохраняется как написана.
    if ((lemma.endsWith('ěti') || lemma.endsWith('eti')) && lemma.length > 4) {
        const root = lemma.slice(0, -3);
        const yat = lemma.slice(-3, -2);
        if (JE_CLASS_ETI.test(foldDiacritics(lemma))) {
            return { infStem: root + yat, presentStem: root + yat + 'je', aoristStem: root + yat, verbClass: 'I' };
        }
        return { infStem: root + yat, presentStem: root + 'i', aoristStem: root + yat, verbClass: 'IV' };
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
    // Основа на гласный (čuti, piti, kryti, byti): презенс на -je- — čuje, pije.
    // Без j получалось "cueš"/"cue".
    if (FINAL_VOWEL.test(rawRoot)) {
        return { infStem: rawRoot, presentStem: rawRoot + 'je', aoristStem: rawRoot, verbClass: 'I' };
    }
    const palatalizedRoot = applyFirstPalatalization(rawRoot);
    return { infStem: rawRoot, presentStem: palatalizedRoot + 'e', aoristStem: rawRoot, verbClass: 'I' };
}

const FOLDED_VERBAL_PREFIXES = new Set([...VERBAL_PREFIXES].map((p) => foldDiacritics(p)));

/**
 * Нерегулярный презенс глагола (см. IRREGULAR_PRESENTS), с приставкой, если
 * она есть: prodati -> prodam. Приставка проверяется по списку, иначе
 * "gledati" сошло бы за gle + dati.
 */
export function irregularPresent(infinitive: string): FullParadigm[] | null {
    const lemma = infinitive.toLowerCase().trim();
    const folded = foldDiacritics(lemma);
    for (const [key, paradigms] of Object.entries(IRREGULAR_PRESENTS)) {
        const foldedKey = foldDiacritics(key);
        if (!folded.endsWith(foldedKey)) continue;
        const prefixLength = folded.length - foldedKey.length;
        // Приставочные от byti (zabyti, dobyti) спрягаются иначе — только сам byti.
        if (key === 'byti' && prefixLength > 0) continue;
        if (!FOLDED_VERBAL_PREFIXES.has(folded.slice(0, prefixLength))) continue;
        const prefix = lemma.slice(0, prefixLength);
        return paradigms.map((paradigm) => {
            const prefixed = {} as FullParadigm;
            (Object.keys(paradigm) as Array<keyof FullParadigm>).forEach((k) => {
                prefixed[k] = prefix + paradigm[k];
            });
            return prefixed;
        });
    }
    return null;
}

/**
 * Инфинитив в каноническом написании. value глагола часто записан без
 * диакритики ("uciti", "videti", "cuti"), а стем — с ней ("uči", "vidě", "ču"),
 * и по value классы и чередования выводились неверно: "ucių" вместо "uču",
 * "cueš" вместо "čuješ". У AUX-лексем стем — сам инфинитив ("mogti").
 */
export function canonicalInfinitive(head: string, stem?: string | null): string {
    const h = head.toLowerCase().trim();
    // Стем глагола с хвостом хранит и хвост ("zavisěti od") — голова одна.
    const s = (stem ?? '').toLowerCase().trim().split(/\s+/)[0];
    if (!s) return h;
    if (foldDiacritics(s + 'ti') === foldDiacritics(h)) return s + 'ti';
    if (foldDiacritics(s) === foldDiacritics(h)) return s;
    return h;
}

export interface VerbLexemeInput {
    /** Инфинитив без механического хвоста, как он записан в value. */
    head: string;
    stem?: string | null;
    secondaryStem?: string | null;
    tertiaryStem?: string | null;
    aspect: VerbalAspect;
    paradigm: AccentParadigm;
    stressPosition?: number | null;
    morphemes?: { value: string; stressPosition?: number | null }[];
}

/**
 * Модель глагола из полей лексемы — одна на корпусный движок (processVerb) и
 * страницу слова (Word.tsx). До неё страница собирала модель сама и не
 * передавала secondaryStem вовсе, так что "pisati" спрягалось как "pisajų".
 */
export function buildVerbModel(input: VerbLexemeInput): VerbModel {
    const infinitive = canonicalInfinitive(input.head, input.stem);
    const stems = extractProtoStems(infinitive);
    const secondary = input.secondaryStem?.trim() || null;
    return {
        infinitive,
        infStem: stems.infStem,
        presentStem: secondary || stems.presentStem,
        aoristStem: stems.aoristStem,
        tertiaryStem: input.tertiaryStem || undefined,
        // Основа настоящего на -i (vidi, leži, slyši) — IV класс, какой бы класс ни дал инфинитив.
        verbClass: secondary?.endsWith('i') ? 'IV' : stems.verbClass,
        aspect: input.aspect,
        paradigm: input.paradigm,
        stressPosition: input.stressPosition,
        morphemes: input.morphemes,
    };
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
        // Без йотации: govoreči (277 в корпусе), а не govorječi/govorjęti.
        const root = presentStem.slice(0, -1);
        const st = 'verb_part_act_pres_i';
        paMasc = root + getPartEnding(st, 'Masc', 'sg', PRES_ACT_EXTRA, 'ęči');
        paFem = root + getPartEnding(st, 'Fem', 'sg', PRES_ACT_EXTRA, 'ęča');
        paNeut = root + getPartEnding(st, 'Neut', 'sg', PRES_ACT_EXTRA, 'ęče');
        paPl = root + getPartEnding(st, 'Masc', 'pl', PRES_ACT_EXTRA, 'ęči');
    } else {
        const st = 'verb_part_act_pres_th';
        paMasc = baseForVowels + getPartEnding(st, 'Masc', 'sg', PRES_ACT_EXTRA, 'ųči');
        paFem = baseForVowels + getPartEnding(st, 'Fem', 'sg', PRES_ACT_EXTRA, 'ųča');
        paNeut = baseForVowels + getPartEnding(st, 'Neut', 'sg', PRES_ACT_EXTRA, 'ųče');
        paPl = baseForVowels + getPartEnding(st, 'Masc', 'pl', PRES_ACT_EXTRA, 'ųči');
    }

    let ppm: string;
    let ppf: string;
    let ppn: string;
    let pppl: string;
    if (verbClass === 'IV') {
        const root = presentStem.slice(0, -1);
        const st = 'verb_part_pass_pres_i';
        ppm = root + getPartEnding(st, 'Masc', 'sg', PRES_PASS_EXTRA, 'imy');
        ppf = root + getPartEnding(st, 'Fem', 'sg', PRES_PASS_EXTRA, 'ima');
        ppn = root + getPartEnding(st, 'Neut', 'sg', PRES_PASS_EXTRA, 'imo');
        pppl = root + getPartEnding(st, 'Masc', 'pl', PRES_PASS_EXTRA, 'imi');
    } else {
        const isJStem = baseForVowels.endsWith('j');
        const st = isJStem ? 'verb_part_pass_pres_e' : 'verb_part_pass_pres_th';
        const fallbackMasc = isJStem ? 'emy' : 'omy';
        const fallbackFem = isJStem ? 'ema' : 'oma';
        const fallbackNeut = isJStem ? 'emo' : 'omo';
        const fallbackPl = isJStem ? 'emi' : 'omi';
        ppm = baseForVowels + getPartEnding(st, 'Masc', 'sg', PRES_PASS_EXTRA, fallbackMasc);
        ppf = baseForVowels + getPartEnding(st, 'Fem', 'sg', PRES_PASS_EXTRA, fallbackFem);
        ppn = baseForVowels + getPartEnding(st, 'Neut', 'sg', PRES_PASS_EXTRA, fallbackNeut);
        pppl = baseForVowels + getPartEnding(st, 'Masc', 'pl', PRES_PASS_EXTRA, fallbackPl);
    }

    // Страдательное прошедшего: основа + суффикс из ending_allophones (-eny/-ny/-ty).
    // Раньше суффикс был вписан строкой ("enyj"), а таблица не читалась вовсе.
    // IV класс на -iti йотирует корень — stvorjeny (198 в корпусе) против stvoreny
    // (28), rodženy (52) против rodeny (0), — но губные получают просто j:
    // upotrěbjeny (41) против upotrěbljeny (1). У -ěti суффикс идёт после ě: viděny.
    type PastPassiveStemType = 'verb_part_pass_past_en' | 'verb_part_pass_past_n' | 'verb_part_pass_past_t';
    let ppaBase: string;
    let ppaStemType: PastPassiveStemType;
    if (verbClass === 'IV' && !infStem.endsWith('ě')) {
        const root = infStem.slice(0, -1);
        ppaBase = LABIALS.includes(root.slice(-1)) ? root + 'j' : applyIotation(root);
        ppaStemType = 'verb_part_pass_past_en';
    } else if (verbClass === 'IV' || verbClass === 'III') {
        ppaBase = infStem;
        ppaStemType = 'verb_part_pass_past_n';
    } else if (verbClass === 'II') {
        ppaBase = infStem.slice(0, -1);
        ppaStemType = 'verb_part_pass_past_en';
    } else if ('aeiouyěęǫų'.includes(infStem.slice(-1))) {
        ppaBase = infStem;
        ppaStemType = 'verb_part_pass_past_t';
    } else {
        ppaBase = applyFirstPalatalization(infStem);
        ppaStemType = 'verb_part_pass_past_en';
    }
    const PAST_PASSIVE_FALLBACKS: Record<PastPassiveStemType, [string, string, string, string]> = {
        verb_part_pass_past_en: ['eny', 'ena', 'eno', 'eni'],
        verb_part_pass_past_n: ['ny', 'na', 'no', 'ni'],
        verb_part_pass_past_t: ['ty', 'ta', 'to', 'ti'],
    };
    const [ppaMascFallback, ppaFemFallback, ppaNeutFallback, ppaPlFallback] = PAST_PASSIVE_FALLBACKS[ppaStemType];
    const ppaMasc = ppaBase + getPartEnding(ppaStemType, 'Masc', 'sg', PAST_PASS_EXTRA, ppaMascFallback);
    const ppaFem = ppaBase + getPartEnding(ppaStemType, 'Fem', 'sg', PAST_PASS_EXTRA, ppaFemFallback);
    const ppaNeut = ppaBase + getPartEnding(ppaStemType, 'Neut', 'sg', PAST_PASS_EXTRA, ppaNeutFallback);
    const ppaPl = ppaBase + getPartEnding(ppaStemType, 'Masc', 'pl', PAST_PASS_EXTRA, ppaPlFallback);

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

const SHORT_PRESENT_STEM_TYPE = 'verb_present_athematic_a';

export function conjugateFullVerb(verb: VerbModel): ConjugationResult {
    const { infinitive, infStem, presentStem, aoristStem, tertiaryStem, verbClass, aspect, paradigm, morphemes, stressPosition } = verb;
    const overrideFor = (form: string) => resolveStressOverride(form, morphemes, stressPosition) ?? undefined;

    // --- А. ПРЕЗЕНС (НАСТОЯЩЕЕ / БУДУЩЕЕ ПРЯМОЕ) ---
    const hasThematicE = presentStem.endsWith('e');
    const baseForVowels = hasThematicE ? presentStem.slice(0, -1) : presentStem;

    // Заднеязычный I класса палатализуется только перед e: 1 л. ед. и 3 л. мн.
    // сохраняют исходный согласный — mogų/možeš/mogųt, pekų/pečeš/pekųt.
    const velarBase = verbClass === 'I' && hasThematicE && infStem !== baseForVowels
        && applyFirstPalatalization(infStem) === baseForVowels ? infStem : baseForVowels;

    const presentStemType = verbClass === 'IV' ? 'verb_present_athematic_i' : 'verb_present_thematic_e';

    let p1sg = '';
    if (verbClass === 'IV') {
        const root = presentStem.slice(0, -1);
        p1sg = `${applyIotation(root)}${getVE(presentStemType, '1sg', PRES_GRAMMEME, 'ų')}`;
    } else {
        p1sg = `${velarBase}${getVE(presentStemType, '1sg', PRES_GRAMMEME, 'ų')}`;
    }

    const p3pl = verbClass === 'IV'
        ? `${presentStem.slice(0, -1)}${getVE(presentStemType, '3pl', PRES_GRAMMEME, 'ęt')}`
        : `${velarBase}${getVE(presentStemType, '3pl', PRES_GRAMMEME, 'ųt')}`;

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

    const accentParadigmForms = (forms: FullParadigm): FullParadigm => {
        const accented = {} as FullParadigm;
        (Object.keys(forms) as Array<keyof FullParadigm>).forEach((person) => {
            accented[person] = accentPresentForm(forms[person], person);
        });
        return accented;
    };

    // Атематические и супплетивные глаголы (dati, věděti, iměti, hotěti, byti)
    // берут готовую сетку вместо правил.
    const irregular = irregularPresent(infinitive);

    const directParadigm: FullParadigm = irregular ? accentParadigmForms(irregular[0]) : {
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

    // Краткая парадигма настоящего времени для глаголов на -ati и -ěti с
    // презенсом на -ěje- (razuměm). Основа — презентная без тематического "je"
    // ("znaje" -> "zna"); 3 л. мн. берёт "jut" и восстанавливает j ("znajut").
    // Класс III в extractProtoStems покрывает и -ati (presentStem на "aje"), и
    // -ovati (на "uje") — краткую парадигму берут только первые, поэтому
    // проверяем именно окончание основы, а не verbClass.
    const shortPresentStem = presentStem.endsWith('aje') || presentStem.endsWith('ěje') ? presentStem.slice(0, -2) : null;
    let shortPresent: FullParadigm | undefined = shortPresentStem
        ? {
            '1sg': accentPresentForm(`${shortPresentStem}${getVE(SHORT_PRESENT_STEM_TYPE, '1sg', PRES_GRAMMEME, 'm')}`, '1sg'),
            '2sg': accentPresentForm(`${shortPresentStem}${getVE(SHORT_PRESENT_STEM_TYPE, '2sg', PRES_GRAMMEME, 'š')}`, '2sg'),
            '3sg': accentPresentForm(`${shortPresentStem}${getVE(SHORT_PRESENT_STEM_TYPE, '3sg', PRES_GRAMMEME, '')}`, '3sg'),
            '1du': accentPresentForm(`${shortPresentStem}${getVE(SHORT_PRESENT_STEM_TYPE, '1du', PRES_GRAMMEME, 'vě')}`, '1du'),
            '2du': accentPresentForm(`${shortPresentStem}${getVE(SHORT_PRESENT_STEM_TYPE, '2du', PRES_GRAMMEME, 'ta')}`, '2du'),
            '3du': accentPresentForm(`${shortPresentStem}${getVE(SHORT_PRESENT_STEM_TYPE, '3du', PRES_GRAMMEME, 'ta')}`, '3du'),
            '1pl': accentPresentForm(`${shortPresentStem}${getVE(SHORT_PRESENT_STEM_TYPE, '1pl', PRES_GRAMMEME, 'mo')}`, '1pl'),
            '2pl': accentPresentForm(`${shortPresentStem}${getVE(SHORT_PRESENT_STEM_TYPE, '2pl', PRES_GRAMMEME, 'te')}`, '2pl'),
            '3pl': accentPresentForm(`${shortPresentStem}${getVE(SHORT_PRESENT_STEM_TYPE, '3pl', PRES_GRAMMEME, 'jut')}`, '3pl'),
        }
        : undefined;

    // IV класс: краткое 1 л. ед. на -m рядом с йотированным (učim 1 157 и uču 365
    // в корпусе, govorim/govorjų); остальные лица у обеих форм общие.
    if (!shortPresent && verbClass === 'IV' && presentStem.endsWith('i')) {
        shortPresent = {
            ...directParadigm,
            '1sg': accentPresentForm(`${presentStem}${getVE(SHORT_PRESENT_STEM_TYPE, '1sg', PRES_GRAMMEME, 'm')}`, '1sg'),
        };
    }
    if (irregular) {
        shortPresent = irregular[1] ? accentParadigmForms(irregular[1]) : undefined;
    }

    // --- Б. АОРИСТ ---
    // Любая основа на гласный даёт сигматический аорист: byh/by/byste у byti,
    // а не "bye".
    const isVowelStem = ['III', 'IV'].includes(verbClass) || FINAL_VOWEL.test(infStem);

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
    // Основа на š (šьd- у idti и приставочных) получает в мужском роде беглое e:
    // šel, prišel, našel — в корпусе 221/446/770 против единичных šl/prišl. У
    // прочих согласных e не пишется: mogl — 1 436, mogel — 3.
    const lStemMasc = lStem.endsWith('š') ? `${lStem}e` : lStem;
    const lParticiple: LParticiple = {
        masculine: accentLPart(`${lStemMasc}${getLPartEnding('Masc', 'sg', 'l')}`, 'm'),
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
        // После согласной — -i (idi, piši), после гласной — -j (znaj, čuj).
        // Раньше -j ставился всегда: "idj", "jesj".
        if (rootWithoutE.endsWith('j')) impBaseForm = rootWithoutE;
        else if (FINAL_VOWEL.test(rootWithoutE)) impBaseForm = `${rootWithoutE}j`;
        else impBaseForm = `${rootWithoutE}i`;
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
            ...(shortPresent ? { presentOrFutureDirectShort: shortPresent } : {}),
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
