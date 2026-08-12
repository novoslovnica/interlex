import { describe, it, expect } from "vitest";
import {
    AccentParadigm,
    ProtoStemClass,
    StemExtension,
    GrammaticalGender
} from '@/lib/grammar/common';
import { EngineWordInput } from '@/lib/grammar/morphology';
import {
    processNoun,
    processVerb,
    processAdjective,
    processNumeral,
    processPronoun,
    processAdverb,
    processDeterminer,
    processAuxiliary, processUninflected
} from './processors';
import {VerbalAspect} from "@/lib/grammar/common/aspect";

// Вспомогательный хелпер для быстрого поиска конкретной формы по грамматическим признакам в тестах
function findForm(forms: any[], criteria: Record<string, string>): string | undefined {
    const match = forms.find(f =>
        Object.entries(criteria).every(([key, val]) => f.feats[key] === val)
    );
    return match ? match.surfaceForm : undefined;
}

describe('1. Существительные (NOUN)', () => {
    // Пример А: "bob" (Твердая o-основа, мужской род, Мобильная Парадигма C)
    const nounBob: EngineWordInput = {
        id: 1, slug: 'bob-noun', isv: 'bob', pos: 'NOUN',
        paradigm: AccentParadigm.C, gender: GrammaticalGender.MASC, protoStemClass: ProtoStemClass.O_SHORT, stemExtension: StemExtension.NONE
    };
    const bobForms = processNoun(nounBob);

    it('bob: Общее количество падежных форм должно быть 21', () => {
        expect(bobForms.length).toBe(21);
    });

    // Краткий циркумфлекс ̑ на корне в Nom.Sg (2026-07-24: окончание -ъ убрано —
    // совр. интерславянский, а не праслав. реконструкция, см. AGENTS.md)
    it('bob: Именительный ед.ч. несет краткий циркумфлекс (bȏb)', () => {
        expect(findForm(bobForms, { case: 'nominative', number: 'sg' })).toBe('bȏb');
    });

    // Восходящий акут на окончании в Gen.Sg
    it('bob: Родительный ед.ч. окситонируется на окончание (bobá)', () => {
        expect(findForm(bobForms, { case: 'genitive', number: 'sg' })).toBe('bobá');
    });

    // Пример Б: "imę" (Консонантная n-основа, средний род, Парадигма C)
    const nounIme: EngineWordInput = {
        id: 2, slug: 'ime-noun', isv: 'ime', pos: 'NOUN',
        paradigm: AccentParadigm.C, gender: GrammaticalGender.NEUT, protoStemClass: ProtoStemClass.CONSONANT, stemExtension: StemExtension.EN
    };
    const imeForms = processNoun(nounIme);

    // Средний род, парадигма C: ед.ч. всегда несёт краткий циркумфлекс на корне
    // (тот же принцип, что у tělo/bob) — наращение "en" при этом спаяно верно ("imene").
    it('imę: Наличие исторического наращения основы -en- в Gen.Sg (imene)', () => {
        expect(findForm(imeForms, { case: 'genitive', number: 'sg' })).toBe('imȇne');
    });
});

describe('2. Глаголы (VERB)', () => {
    // Пример А: "nesti" (Класс I, атематический согласный, Парадигма C)
    const verbNesti: EngineWordInput = {
        id: 3, slug: 'nesti-verb', isv: 'nesti', pos: 'VERB',
        paradigm: AccentParadigm.C, aspect: VerbalAspect.IPF
    };
    const nestiForms = processVerb(verbNesti);

    it('nesti: Общее количество сгенерированных временных и причастных форм > 35', () => {
        expect(nestiForms.length).toBeGreaterThanOrEqual(35);
    });

    // Парадигма C: 1sg уходит на флексию, остальные формы презенса ретрагируются в абсолютное начало слова
    // Тон — новоакут (закон Дыбо + закон Ившича), тот же тип ретракции, что и в парадигме B (Ретракция Шахматова).
    it('nesti: Настоящее 1sg окситонируется на флексию (nesǫ́ / nesų́)', () => {
        expect(findForm(nestiForms, { verbForm: 'fin', person: '1', number: 'sg', tense: 'pres' })).toBe('nesų́');
    });

    it('nesti: Настоящее 2sg ретрагируется на первый слог (néseš)', () => {
        expect(findForm(nestiForms, { verbForm: 'fin', person: '2', number: 'sg', tense: 'pres' })).toBe('néseš');
    });

    // Причастия раньше вообще не несли диакритики (generateParticiples не вызывал accentSyllable) —
    // не верифицированная деривация, просто проверяем наличие хоть какого-то знака ударения.
    it('nesti: Причастие наст. вр. действ. залога несёт знак ударения', () => {
        const nestiPresActPart = findForm(nestiForms, { verbForm: 'part', tense: 'pres', voice: 'act', gender: 'masc', number: 'sg' });
        expect(!!nestiPresActPart && /[̀́̂̑]/.test(nestiPresActPart!)).toBe(true);
    });

    // Пример Б: "govoriti" (Класс IV, i-основа, Парадигма B)
    const verbGovoriti: EngineWordInput = {
        id: 4, slug: 'govoriti-verb', isv: 'govoriti', pos: 'VERB',
        paradigm: AccentParadigm.B, aspect: VerbalAspect.IPF
    };
    const govoritiForms = processVerb(verbGovoriti);

    // Йотовая палатализация сонорных r/l/n перед j: +j без вставки эпентетического l
    // (в отличие от губных p/b/m/v/f, которые получают +lj). Подтверждено примерами
    // живого словаря: govoriti -> govorjut, galjati -> galjajut, obměniti -> obměnjajut.
    it('govoriti: Наличие йотовой палатализации сонорного r в форме 1sg (govorjų̀)', () => {
        expect(findForm(govoritiForms, { verbForm: 'fin', person: '1', number: 'sg', tense: 'pres' })?.startsWith('govorj')).toBe(true);
    });
});

describe('3. Прилагательные (ADJ)', () => {
    // Пример А: "novy" (Качественное прилагательное, Парадигма C)
    const adjNovy: EngineWordInput = {
        id: 5, slug: 'novy-adj', isv: 'novy', pos: 'ADJ',
        paradigm: AccentParadigm.C, protoStemClass: ProtoStemClass.O_SHORT
    };
    const novyForms = processAdjective(adjNovy);

    // 63 базовые формы + 63 компаратив + 63 суперлатив = 189 словоформ
    it('novy: Качественное прилагательное разворачивает все три степени сравнения (189 форм)', () => {
        expect(novyForms.length).toBe(189);
    });

    // Унифицировано с уже живой реализацией AdjectiveDeclensionTables.tsx (мягкое
    // склонение JO_SHORT + суффикс -ějš-, ять, а не праслав. плоское 'e').
    // Полная (склоняемая) форма компаратива несёт окончание adj_soft/Masc/Nom.Sg = 'i'
    // (согласовано БД ending_allophones и хардкод-регистром ADJECTIVE_ENDINGS_REGISTRY —
    // до фикса регистра рода этот grammeme-лукап молча промахивался мимо БД, и
    // '?? ADJECTIVE_ENDINGS_REGISTRY' никогда не срабатывал из-за того что getEnding() всегда
    // возвращает строку, даже пустую. Ударение остаётся на суффиксе -ějš-
    // (как и задумано комментарием выше), просто теперь корректно попадает на его
    // гласную 'ě' в полной, а не усечённой форме.
    it('novy: Компаратив образует суффикс -ějš- с мягким склонением (nově̂jši)', () => {
        expect(findForm(novyForms, { case: 'nominative', number: 'sg', gender: 'masc', degree: 'comp' })).toBe('nově̂jši');
    });

    // Пример Б: "kamienny" (Относительное прилагательное, Парадигма A)
    const adjKamienny: EngineWordInput = {
        id: 6, slug: 'kamienny-adj', isv: 'kamienny', pos: 'ADJ',
        paradigm: AccentParadigm.A, protoStemClass: ProtoStemClass.O_SHORT
    };
    const kamiennyForms = processAdjective(adjKamienny);

    it('kamienny: Относительное прилагательное генерирует ТОЛЬКО базовую степень сравнения (63 формы)', () => {
        expect(kamiennyForms.length).toBe(63);
    });
});

describe('4. Числительные (NUM)', () => {
    // Пример А: "dva" (Количественное числительное подкласса 2-4, Парадигма C)
    const numDva: EngineWordInput = { id: 7, slug: 'dva-num', isv: 'dva', pos: 'NUM', paradigm: AccentParadigm.C };
    const dvaForms = processNumeral(numDva);

    // Ять (ě) верна — подтверждено пользователем и БД (ending_allophones), ошибался тест.
    it('dva: Родовое разведение в им.п. для женского/среднего рода (dvě̂)', () => {
        expect(findForm(dvaForms, { case: 'nominative', gender: 'fem' })).toBe('dvě̂');
    });

    // Пример Б: "pęty" (Порядковое числительное, Парадигма A)
    const numPety: EngineWordInput = { id: 8, slug: 'pety-num', isv: 'pęty', pos: 'NUM', paradigm: AccentParadigm.A };
    const petyForms = processNumeral(numPety);

    it('pęty: Порядковое числительное успешно проксируется в адъективный движок (63 формы)', () => {
        expect(petyForms.length).toBe(63);
    });
});

describe('5. Местоимения и Определители (PRON / DET)', () => {
    // Местоимение "ja" (Личное местоимение, Парадигма C)
    const pronJa: EngineWordInput = { id: 9, slug: 'ja-pron', isv: 'ja', pos: 'PRON', paradigm: AccentParadigm.C };
    const jaForms = processPronoun(pronJa);

    // Проверяем полную ударную форму и энклитическую безударную
    // Ять (ě) верна — подтверждено пользователем и БД, ошибался тест.
    it('ja: Наличие полной ударной формы в дат.п. (meně́)', () => {
        expect(findForm(jaForms, { case: 'dative', number: 'sg', degree: 'full' as any })).toBe('meně́');
    });

    it('ja: Наличие энклитической безударной формы в дат.п. без диакритики (mi)', () => {
        expect(findForm(jaForms, { case: 'dative', number: 'sg', degree: 'short' as any })).toBe('mi');
    });
});

describe('6. Наречия и Служебные категории (ADV / AUX / PUNCT)', () => {
    // Наречие "dobro" (Качественное наречие)
    const advDobro: EngineWordInput = { id: 10, slug: 'dobro-adv', isv: 'dobro', pos: 'ADV' };
    const dobroForms = processAdverb(advDobro);

    // Ять (ě) верна — подтверждено пользователем и напрямую из БД (ending_allophones:
    // adverb_comp='ěje'), ошибался тест.
    it('dobro: Наличие компаратива (dobrě́je)', () => {
        expect(findForm(dobroForms, { degree: 'comp' })).toBe('dobrě́je');
    });

    it('dobro: Наличие суперлатива с префиксом (najdobrě́je)', () => {
        expect(findForm(dobroForms, { degree: 'sup' })).toBe('najdobrě́je');
    });

    // Вспомогательный глагол "byti" (AUX)
    const auxByti: EngineWordInput = { id: 11, slug: 'byti-aux', isv: 'byti', pos: 'AUX' };
    const bytiForms = processAuxiliary(auxByti);

    it('byti: Автоматическое развертывание супплетивной атематической сетки настоящего времени (jest)', () => {
        expect(bytiForms.some(f => f.surfaceForm === 'jest' && f.feats.tense === 'pres')).toBe(true);
    });

    // Знак препинания (PUNCT)
    const punctDot: EngineWordInput = { id: 12, slug: 'dot-punct', isv: '.', pos: 'PUNCT' };
    const dotForms = processUninflected(punctDot);

    it('punct: Служебный инвариант возвращает неизмененный символ без грамматических признаков', () => {
        expect(dotForms[0].surfaceForm === '.' && Object.keys(dotForms[0].feats).length === 0).toBe(true);
    });
});
