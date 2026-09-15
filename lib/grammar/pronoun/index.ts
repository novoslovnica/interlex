import {
    AccentParadigm,
    GrammaticalGender
} from '@/lib/grammar/common'; // Системные Enum из таблицы Word
import { Case, NumberType } from '../endingsRegistry';
import { FourSlavicTones } from '../fourTonesGenerator';
import { getEnding } from '@/lib/grammar/endingLoader';
import { ADJECTIVE_ENDINGS_REGISTRY } from '@/lib/grammar/adjective';
import { resolveStressOverride } from '@/lib/grammar/stress';
import { foldDiacritics } from '@/lib/corpus/tokenizer/foldDiacritics';

// =========================================================================
// 1. СТРОГИЕ ИНТЕРФЕЙСЫ И ТИПЫ ДАННЫХ
// =========================================================================

// 'demonstrative_who_what' исторически был классом «всё, что не ja/ty» — теперь
// это только семейство kto/čto и неизменяемый остаток. Имя сохранено, им
// пользуются вызывающие.
export type PronounClass = 'personal' | 'demonstrative_who_what' | 'anaphoric' | 'reflexive' | 'pronominal';

export interface EnhancedPronounDbItem {
    interslavic: string;       // Словарная форма (н-р: "ja", "ty", "kto", "čto", "on")
    protoSlavic: string;
    paradigm: AccentParadigm; // A, B, C
    pronClass: PronounClass;  // Классификатор типа местоимения
    stressPosition?: number | null;      // Переопределение ударения словом целиком (заимствования)
    morphemes?: { value: string; stressPosition?: number | null }[]; // Переопределение ударным суффиксом/корнем
}

export interface PronounFormRequest {
    dbItem: EnhancedPronounDbItem;
    targetCase: Case;
    targetNumber: NumberType;
    targetGender?: GrammaticalGender; // Важно для местоимений 3-го лица (on, ona, ono)
    isEnclitic?: boolean;             // Флаг запроса краткой формы (н-р: mę вместо mene)
}

export interface PronounAnalysis {
    pronClass: PronounClass;
    /** Личные: сетка ja/ty. my/vy — та же сетка, но только во множественном числе. */
    personalBase?: 'ja' | 'ty';
    onlyNumber?: NumberType;
    whoWhatBase?: 'kto' | 'čto';
    /** Местоименные прилагательные: склоняются по окончаниям adj_soft/adj_hard. */
    pronominal?: { stem: string; soft: boolean; shortMasc: string | null };
    /** ni-/ně-/vse-... перед kto/čto/čij/koj. */
    prefix: string;
    /** -koli/-libo/-nebųď/-že после склоняемой части. */
    suffix: string;
}

// =========================================================================
// 2. РЕЕСТРЫ ФЛЕКСИЙ И СУППЛЕТИВНЫХ ОСНОВ МЕСТОИМЕНИЙ
// =========================================================================

// База полных и кратких форм для личных местоимений (Супплетивные сетки).
//
// 2026-08-24: сетка была праславянской — "nasъ"/"namъ"/"vasъ"/"vamъ"/"mьně"/
// "mьnojǫ"/"tobojǫ" и "kěmь"/"komь"/"čimь"/"čemь" ниже. Те же два
// преобразования, что применялись к существительным 2026-07-24: снять
// конечный/внутренний ер и заменить носовой ǫ на современный ų (см. AGENTS.md,
// "RESOLVED: Grammar Engine Was Producing Wrong Endings"). Формы вроде "nasъ"
// в корпусе не встречаются вообще — они лежали в индексе мёртвым грузом.
//
// Двойственное "na" (вин. от ja) оставлено по решению мейнтейнера, хотя оно и
// сталкивается с частотным предлогом "na".
const PERSONAL_PRONOUNS_REGISTRY: Record<'ja' | 'ty', Record<NumberType, Record<Case, { full: string; short?: string }>>> = {
    ja: {
        [NumberType.SINGULAR]: {
            [Case.NOMINATIVE]: { full: 'ja' },
            [Case.ACCUSATIVE]: { full: 'mene', short: 'mę' },
            [Case.GENITIVE]: { full: 'mene', short: 'mę' },
            [Case.DATIVE]: { full: 'meně', short: 'mi' },
            [Case.INSTRUMENTAL]: { full: 'mnojų' },
            [Case.LOCATIVE]: { full: 'mně' },
            [Case.VOCATIVE]: { full: 'ja' }
        },
        [NumberType.PLURAL]: {
            [Case.NOMINATIVE]: { full: 'my' }, [Case.ACCUSATIVE]: { full: 'nas', short: 'ny' }, [Case.GENITIVE]: { full: 'nas' }, [Case.DATIVE]: { full: 'nam' }, [Case.INSTRUMENTAL]: { full: 'nami' }, [Case.LOCATIVE]: { full: 'nas' }, [Case.VOCATIVE]: { full: 'my' }
        },
        [NumberType.DUAL]: {
            [Case.NOMINATIVE]: { full: 'vě' }, [Case.ACCUSATIVE]: { full: 'na' }, [Case.GENITIVE]: { full: 'naju' }, [Case.DATIVE]: { full: 'nama' }, [Case.INSTRUMENTAL]: { full: 'nama' }, [Case.LOCATIVE]: { full: 'naju' }, [Case.VOCATIVE]: { full: 'vě' }
        }
    },
    ty: {
        [NumberType.SINGULAR]: {
            [Case.NOMINATIVE]: { full: 'ty' },
            [Case.ACCUSATIVE]: { full: 'tebe', short: 'tę' },
            [Case.GENITIVE]: { full: 'tebe', short: 'tę' },
            [Case.DATIVE]: { full: 'tobě', short: 'ti' },
            [Case.INSTRUMENTAL]: { full: 'tobojų' },
            [Case.LOCATIVE]: { full: 'tobě' },
            [Case.VOCATIVE]: { full: 'ty' }
        },
        [NumberType.PLURAL]: {
            [Case.NOMINATIVE]: { full: 'vy' }, [Case.ACCUSATIVE]: { full: 'vas', short: 'vy' }, [Case.GENITIVE]: { full: 'vas' }, [Case.DATIVE]: { full: 'vam' }, [Case.INSTRUMENTAL]: { full: 'vami' }, [Case.LOCATIVE]: { full: 'vas' }, [Case.VOCATIVE]: { full: 'vy' }
        },
        [NumberType.DUAL]: {
            [Case.NOMINATIVE]: { full: 'va' }, [Case.ACCUSATIVE]: { full: 'va' }, [Case.GENITIVE]: { full: 'vaju' }, [Case.DATIVE]: { full: 'vama' }, [Case.INSTRUMENTAL]: { full: 'vama' }, [Case.LOCATIVE]: { full: 'vaju' }, [Case.VOCATIVE]: { full: 'va' }
        }
    }
};

// Возвратное местоимение: полные формы и энклитики, как у ja/ty.
const REFLEXIVE_REGISTRY: Record<Case, { full: string; short?: string; alternates?: string[] }> = {
    [Case.NOMINATIVE]: { full: 'sebe' },
    [Case.ACCUSATIVE]: { full: 'sebe', short: 'sę' },
    [Case.GENITIVE]: { full: 'sebe' },
    [Case.DATIVE]: { full: 'sebě', short: 'si', alternates: ['sobě'] },
    [Case.INSTRUMENTAL]: { full: 'sobojų' },
    [Case.LOCATIVE]: { full: 'sebě', alternates: ['sobě'] },
    [Case.VOCATIVE]: { full: 'sebe' },
};

// Сетка неличных вопросительных местоимений (kto/čto)
const INTERROGATIVE_PRONOUNS: Record<'kto' | 'čto', Record<Case, string>> = {
    kto: {
        [Case.NOMINATIVE]: 'kto', [Case.ACCUSATIVE]: 'kogo', [Case.GENITIVE]: 'kogo', [Case.DATIVE]: 'komu', [Case.INSTRUMENTAL]: 'kěm', [Case.LOCATIVE]: 'kom', [Case.VOCATIVE]: 'kto'
    },
    čto: {
        [Case.NOMINATIVE]: 'čto', [Case.ACCUSATIVE]: 'čto', [Case.GENITIVE]: 'česo', [Case.DATIVE]: 'čemu', [Case.INSTRUMENTAL]: 'čim', [Case.LOCATIVE]: 'čem', [Case.VOCATIVE]: 'čto'
    }
};

// Второе живое написание тех же падежей. В сетке остаётся исходная форма, а эти
// распознаются наравне с ней: в корпусе "čego" (625) и "ničego" (536) —
// основное написание, "česo" встречается единично.
const INTERROGATIVE_ALTERNATES: Record<'kto' | 'čto', Partial<Record<Case, string[]>>> = {
    kto: { [Case.INSTRUMENTAL]: ['kym'] },
    čto: { [Case.GENITIVE]: ['čego'] },
};

// Местоименные прилагательные с кратким именительным мужского рода: сам
// именительный (и совпадающие с ним вин./зват.) — словарная форма, остальные
// падежи — основа + полные адъективные окончания (adj_soft/adj_hard из
// ending_allophones, те же, что у прилагательных). До этого все они, кроме
// on, выдавали словарную форму во всех 21 клетке: "svoj", "svoj", "svoj"...
// — и svojego/mojej/vsih (десятки тысяч вхождений в корпусе) не распознавались.
const SOFT_SHORT_PRONOMINALS = /^(ni|ně|ne|ino|poně|pone)?(moj|tvoj|svoj|naš|vaš|čij|cij|koj)$/;
const ALL_WORD_FORMS = new Set(['vėś', 'ves', 'vsi', 'vsij', 'vesj', 'vjesj']);
const HARD_SHORT_PRONOMINALS: Record<string, string> = {
    'tȯj': 't', 'toj': 't',
    'tutȯj': 'tut', 'tutoj': 'tut',
    'tamtȯj': 'tamt', 'tamtoj': 'tamt',
    'ovȯj': 'ov', 'ov': 'ov',
    'sam': 'sam',
    'jedin': 'jedn', 'jeden': 'jedn', 'nijedin': 'nijedn',
    'žadėn': 'žadn', 'žaden': 'žadn',
    'jegov': 'jegov', 'jejin': 'jejin',
};

const WHO_WHAT = /^(ni|ně|ne|vse|ino|za)?(kto|čto|cto)$/;
const PARTICLE_SUFFIX = /^(.+?)(-?(?:koli|libo|nebųď|nebud)|že)$/;

// =========================================================================
// 3. КЛАССИФИКАЦИЯ
// =========================================================================

/**
 * Каноническая лемма: у многих местоимений value записано без диакритики
 * ("cto", "tutoj", "sej"), а стем — с ней ("čto", "tutȯj", "sėj"). Берём стем,
 * если это то же слово с точностью до диакритики, иначе value.
 */
export function canonicalPronounLemma(value: string | null | undefined, stem: string | null | undefined): string {
    const v = (value ?? '').toLowerCase().trim();
    const s = (stem ?? '').toLowerCase().trim();
    return s && foldDiacritics(s) === foldDiacritics(v) ? s : v;
}

function classifyBase(base: string, suffix: string): PronounAnalysis | null {
    const whoWhat = base.match(WHO_WHAT);
    if (whoWhat) {
        return {
            pronClass: 'demonstrative_who_what',
            whoWhatBase: whoWhat[2] === 'kto' ? 'kto' : 'čto',
            prefix: whoWhat[1] ?? '',
            suffix,
        };
    }

    const hardStem = HARD_SHORT_PRONOMINALS[base];
    if (hardStem) {
        return { pronClass: 'pronominal', pronominal: { stem: hardStem, soft: false, shortMasc: base }, prefix: '', suffix };
    }

    if (ALL_WORD_FORMS.has(base)) {
        return { pronClass: 'pronominal', pronominal: { stem: 'vs', soft: true, shortMasc: 'vėś' }, prefix: '', suffix };
    }

    const soft = base.match(SOFT_SHORT_PRONOMINALS);
    if (soft) {
        const stem = soft[2] === 'cij' ? 'čij' : soft[2];
        return { pronClass: 'pronominal', pronominal: { stem, soft: true, shortMasc: stem }, prefix: soft[1] ?? '', suffix };
    }

    // Полная форма на -y (kaky, ktory, něky, jihny) — обычное твёрдое
    // прилагательное: краткого именительного нет.
    if (base.length > 2 && base.endsWith('y')) {
        return { pronClass: 'pronominal', pronominal: { stem: base.slice(0, -1), soft: false, shortMasc: null }, prefix: '', suffix };
    }

    return null;
}

export function classifyPronoun(rawLemma: string): PronounAnalysis {
    const lemma = rawLemma.toLowerCase().trim();

    if (lemma === 'ja' || lemma === 'ty') return { pronClass: 'personal', personalBase: lemma, prefix: '', suffix: '' };
    if (lemma === 'my' || lemma === 'vy') {
        return { pronClass: 'personal', personalBase: lemma === 'my' ? 'ja' : 'ty', onlyNumber: NumberType.PLURAL, prefix: '', suffix: '' };
    }
    if (lemma === 'on') return { pronClass: 'anaphoric', prefix: '', suffix: '' };
    if (lemma === 'sebe' || lemma === 'sebę') return { pronClass: 'reflexive', prefix: '', suffix: '' };

    // Сначала слово целиком, потом без частицы: "kakykoli" -> kaky + koli,
    // "tȯjže" -> tȯj + že.
    const direct = classifyBase(lemma, '');
    if (direct) return direct;
    const withParticle = lemma.match(PARTICLE_SUFFIX);
    if (withParticle) {
        const found = classifyBase(withParticle[1], withParticle[2]);
        if (found) return found;
    }

    return { pronClass: 'demonstrative_who_what', prefix: '', suffix: '' };
}

// =========================================================================
// 4. НИЗКОУРОВНЕВАЯ ТОНОВАЯ АВТОМАТИКА ДИАКРИТИКИ
// =========================================================================

function isShortVowel(char: string): boolean {
    return /[oe]/i.test(char);
}

function applyFourTonesMark(word: string, syllableIndex: number, tone: FourSlavicTones): string {
    const vowels = /[aeiouyěęǫọųьmъ]/gi; // Включаем редуцированные, способные нести праславянский слоговой тон
    const matches = Array.from(word.matchAll(vowels));
    if (matches.length === 0) return word;

    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;
    const char = word[targetIndex];

    let unicodeMark = '́';
    switch (tone) {
        case 'long_acute': unicodeMark = '́'; break;
        case 'short_acute': unicodeMark = '̀'; break;
        case 'long_circumflex': unicodeMark = '̂'; break;
        case 'short_circumflex': unicodeMark = '̑'; break;
    }
    return word.substring(0, targetIndex) + char + unicodeMark + word.substring(targetIndex + 1);
}

function getAcuteToneType(word: string, syllableIndex: number): 'long_acute' | 'short_acute' {
    const vowels = /[aeiouyěęǫọųьъ]/gi;
    const matches = Array.from(word.matchAll(vowels));
    if (matches.length === 0) return 'long_acute';
    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;
    return isShortVowel(word[targetIndex]) ? 'short_acute' : 'long_acute';
}

function getCircumflexToneType(word: string, syllableIndex: number): 'long_circumflex' | 'short_circumflex' {
    const vowels = /[aeiouyěęǫọųьъ]/gi;
    const matches = Array.from(word.matchAll(vowels));
    if (matches.length === 0) return 'long_circumflex';
    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;
    return isShortVowel(word[targetIndex]) ? 'short_circumflex' : 'long_circumflex';
}

// =========================================================================
// 5. ДВИЖОК СКЛОНЕНИЯ И ТОНИРОВАНИЯ МЕСТОИМЕНИЙ
// =========================================================================

function adjectiveEnding(soft: boolean, targetNumber: NumberType, targetCase: Case, targetGender: GrammaticalGender): string {
    const stemType = soft ? 'adj_soft' : 'adj_hard';
    return getEnding(stemType, targetNumber, targetCase, 'CORE', targetGender)
        || ADJECTIVE_ENDINGS_REGISTRY[stemType][targetNumber][targetGender][targetCase];
}

function unique(forms: string[]): string[] {
    return [...new Set(forms)];
}

// Формы 3-го лица после предлога получают n-: "k njemu", "od njih", "s njej".
function withPrepositionalN(forms: string[]): string[] {
    return unique([...forms, ...forms.filter((f) => f.startsWith('j')).map((f) => 'n' + f)]);
}

function anaphoricForms(targetCase: Case, targetNumber: NumberType, targetGender: GrammaticalGender): string[] {
    // Двойственное 3-го лица на практике не встречается, а адъективное "ja"
    // (вин. дв.) совпадало бы с личным ja — отдаём формы множественного.
    if (targetNumber === NumberType.DUAL) return anaphoricForms(targetCase, NumberType.PLURAL, targetGender);
    if (targetNumber === NumberType.SINGULAR) {
        // Местоимение 3-го лица в косвенных падежах образует супплетивную основу *j- (jego, jemu...)
        // Звательный — как именительный: иначе получались "ji"/"ja"/"je", и "ja"
        // совпадало с личным местоимением ja.
        const isDirect = targetCase === Case.NOMINATIVE || targetCase === Case.VOCATIVE
            || (targetCase === Case.ACCUSATIVE && targetGender === GrammaticalGender.NEUT);
        if (isDirect) {
            return [targetGender === GrammaticalGender.FEM ? 'ona' : targetGender === GrammaticalGender.NEUT ? 'ono' : 'on'];
        }
        return withPrepositionalN(['j' + adjectiveEnding(true, targetNumber, targetCase, targetGender)]);
    }

    if (targetCase === Case.NOMINATIVE || targetCase === Case.VOCATIVE) {
        return [targetGender === GrammaticalGender.FEM ? 'one' : targetGender === GrammaticalGender.NEUT ? 'ona' : 'oni'];
    }
    const forms = ['j' + adjectiveEnding(true, targetNumber, targetCase, targetGender)];
    // Вин. мн. в ISV — прежде всего "jih" (как род.), адъективное "je" остаётся вариантом.
    if (targetCase === Case.ACCUSATIVE && targetNumber === NumberType.PLURAL) forms.unshift('jih');
    return withPrepositionalN(forms);
}

function pronominalForms(analysis: PronounAnalysis, targetCase: Case, targetNumber: NumberType, targetGender: GrammaticalGender): string[] {
    const p = analysis.pronominal!;
    const wrap = (core: string) => analysis.prefix + core + analysis.suffix;
    const inflected = (c: Case) => wrap(p.stem + adjectiveEnding(p.soft, targetNumber, c, targetGender));

    const isShortCell = !!p.shortMasc && targetNumber === NumberType.SINGULAR && targetGender === GrammaticalGender.MASC
        && (targetCase === Case.NOMINATIVE || targetCase === Case.ACCUSATIVE || targetCase === Case.VOCATIVE);
    const primary = isShortCell ? wrap(p.shortMasc!) : inflected(targetCase);

    // Вин. ед. мужского рода одушевлённого совпадает с родительным (mojego, togo).
    if (targetCase === Case.ACCUSATIVE && targetNumber === NumberType.SINGULAR && targetGender === GrammaticalGender.MASC) {
        return unique([primary, inflected(Case.GENITIVE)]);
    }
    return [primary];
}

function rawPronounForms(request: PronounFormRequest): { forms: string[]; unstressed: boolean } {
    const { dbItem, targetCase, targetNumber, targetGender = GrammaticalGender.MASC, isEnclitic = false } = request;
    const lemma = dbItem.interslavic.toLowerCase().trim();
    const analysis = classifyPronoun(lemma);

    switch (analysis.pronClass) {
        case 'personal': {
            const cell = PERSONAL_PRONOUNS_REGISTRY[analysis.personalBase!][analysis.onlyNumber ?? targetNumber][targetCase];
            // КРАТКИЕ ФОРМЫ (энклитики типа mę, mi, ti) ФИЗИЧЕСКИ БЕЗУДАРНЫ
            if (isEnclitic && cell.short) return { forms: [cell.short], unstressed: true };
            return { forms: [cell.full], unstressed: false };
        }
        case 'reflexive': {
            const cell = REFLEXIVE_REGISTRY[targetCase];
            if (isEnclitic && cell.short) return { forms: [cell.short], unstressed: true };
            return { forms: [cell.full, ...(cell.alternates ?? [])], unstressed: false };
        }
        case 'anaphoric':
            return { forms: anaphoricForms(targetCase, targetNumber, targetGender), unstressed: false };
        case 'pronominal':
            return { forms: pronominalForms(analysis, targetCase, targetNumber, targetGender), unstressed: false };
        default: {
            if (!analysis.whoWhatBase) return { forms: [lemma], unstressed: false };
            const base = analysis.whoWhatBase;
            const cores = [INTERROGATIVE_PRONOUNS[base][targetCase], ...(INTERROGATIVE_ALTERNATES[base][targetCase] ?? [])];
            return { forms: cores.map((core) => analysis.prefix + core + analysis.suffix), unstressed: false };
        }
    }
}

// =========================================================================
// ТОНОВЫЕ ПРАВИЛА ЗАЛИЗНЯКА И СЛАВЯНСКАЯ АКЦЕНТОЛОГИЯ МЕСТОИМЕНИЙ
// =========================================================================
function accentPronoun(rawForm: string, dbItem: EnhancedPronounDbItem, targetCase: Case): string {
    // Переопределение ударения морфемой (ударный суффикс/корень) или словом целиком
    // (заимствования) — переопределяет только СЛОГ, тип тона решает парадигма ниже.
    const override = resolveStressOverride(rawForm, dbItem.morphemes, dbItem.stressPosition) ?? undefined;

    // ПАРАДИГМА A (Стационарная): Ударение строго фиксировано на корне
    if (dbItem.paradigm === AccentParadigm.A) {
        const idx = override ?? 1;
        return applyFourTonesMark(rawForm, idx, getAcuteToneType(rawForm, idx));
    }

    // ПАРАДИГМА B (Окситонная): Местоимения типа *kto, *čto, *on исторически окситонировались
    if (dbItem.paradigm === AccentParadigm.B) {
        // В коротких закрытых падежах на редуцированные (ъ/ь) — ретракция на корень
        if (rawForm.endsWith('ъ') || rawForm.endsWith('ь') || rawForm.length <= 3) {
            const idx = override ?? 1;
            return applyFourTonesMark(rawForm, idx, getAcuteToneType(rawForm, idx)); // kòstь, tъ̀
        }
        // В остальных падежах — восходящее ударение на окончание (kogá, jemú)
        const idx = override ?? 0;
        return applyFourTonesMark(rawForm, idx, getAcuteToneType(rawForm, idx));
    }

    // ПАРАДИГМА C (Мобильная): Личные местоимения (ja, ty) — абсолютные энклиномены
    if (dbItem.paradigm === AccentParadigm.C) {
        const isDirectCase = targetCase === Case.NOMINATIVE || targetCase === Case.VOCATIVE;

        if (isDirectCase) {
            // Именительный падеж личных местоимений несет нисходящий циркумфлекс (jâ, tŷ)
            const idx = override ?? 1;
            return applyFourTonesMark(rawForm, idx, getCircumflexToneType(rawForm, idx));
        }

        // В полных косвенных падежах (mene, tebe, tobě) ударение падает на окончание (восходящий тон)
        const idx = override ?? 0;
        return applyFourTonesMark(rawForm, idx, getAcuteToneType(rawForm, idx)); // mené, tebé
    }

    return rawForm;
}

/** Все живые написания клетки: основное первым, затем варианты (čego, njemu, mojego для вин.). */
export function generatePronounForms(request: PronounFormRequest): string[] {
    const { forms, unstressed } = rawPronounForms(request);
    return unstressed ? forms : forms.map((form) => accentPronoun(form, request.dbItem, request.targetCase));
}

export function generatePronounForm(request: PronounFormRequest): string {
    return generatePronounForms(request)[0];
}
