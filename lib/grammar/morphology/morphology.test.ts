import {
    PosType,
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

export function runMorphologyEngineTests(): void {
    console.log('🧪 ЗАПУСК КОМПЛЕКСНОГО ТЕСТИРОВАНИЯ MORPHOLOGY ENGINE...\n');
    let passedTests = 0;
    let totalTests = 0;

    const assert = (description: string, expression: boolean) => {
        totalTests++;
        if (expression) {
            passedTests++;
            console.log(`  ✅ PASSED: ${description}`);
        } else {
            console.error(`  ❌ FAILED: ${description}`);
        }
    };

    // =========================================================================
    // 1. ТЕСТЫ СУЩЕСТВЕННЫХ (NOUN)
    // =========================================================================
    console.log('--- 1. Существительные (NOUN) ---');

    // Пример А: "bob" (Твердая o-основа, мужской род, Мобильная Парадигма C)
    const nounBob: EngineWordInput = {
        id: 1, slug: 'bob-noun', isv: 'bob', pos: 'NOUN',
        paradigm: AccentParadigm.C, gender: GrammaticalGender.MASC, protoStemClass: ProtoStemClass.O_SHORT, stemExtension: StemExtension.NONE
    };
    const bobForms = processNoun(nounBob);
    assert('bob: Общее количество падежных форм должно быть 21', bobForms.length === 21);
    // Краткий циркумфлекс \u0311 на корне в Nom.Sg
    assert('bob: Именительный ед.ч. несет краткий циркумфлекс (bȏbъ)', findForm(bobForms, { case: 'nominative', number: 'sg' }) === 'bo\u0311bъ');
    // Восходящий акут на окончании в Gen.Sg
    assert('bob: Родительный ед.ч. окситонируется на окончание (bobá)', findForm(bobForms, { case: 'genitive', number: 'sg' }) === 'boba\u0301');

    // Пример Б: "imę" (Консонантная n-основа, средний род, Парадигма C)
    const nounIme: EngineWordInput = {
        id: 2, slug: 'ime-noun', isv: 'ime', pos: 'NOUN',
        paradigm: AccentParadigm.C, gender: GrammaticalGender.NEUT, protoStemClass: ProtoStemClass.CONSONANT, stemExtension: StemExtension.EN
    };
    const imeForms = processNoun(nounIme);
    assert('imę: Наличие исторического наращения основы -en- в Gen.Sg (imené)', findForm(imeForms, { case: 'genitive', number: 'sg' }) === 'imene\u0301');


    // =========================================================================
    // 2. ТЕСТЫ ГЛАГОЛОВ (VERB)
    // =========================================================================
    console.log('\n--- 2. Глаголы (VERB) ---');

    // Пример А: "nesti" (Класс I, атематический согласный, Парадигма C)
    const verbNesti: EngineWordInput = {
        id: 3, slug: 'nesti-verb', isv: 'nesti', pos: 'VERB',
        paradigm: AccentParadigm.C, aspect: VerbalAspect.IPF
    };
    const nestiForms = processVerb(verbNesti);
    assert('nesti: Общее количество сгенерированных временных и причастных форм > 35', nestiForms.length >= 35);
    // Парадигма C: 1sg уходит на флексию, остальные формы презенса ретрагируются в абсолютное начало слова
    assert('nesti: Настоящее 1sg окситонируется на флексию (nesǫ́ / nesų́)', findForm(nestiForms, { verbForm: 'fin', person: '1', number: 'sg', tense: 'pres' }) === 'nesų\u0301');
    assert('nesti: Настоящее 2sg ретрагируется на первый слог (néseš)', findForm(nestiForms, { verbForm: 'fin', person: '2', number: 'sg', tense: 'pres' }) === 'ne\u0301seš');

    // Пример Б: "govoriti" (Класс IV, i-основа, Парадигма B)
    const verbGovoriti: EngineWordInput = {
        id: 4, slug: 'govoriti-verb', isv: 'govoriti', pos: 'VERB',
        paradigm: AccentParadigm.B, aspect: VerbalAspect.IPF
    };
    const govoritiForms = processVerb(verbGovoriti);
    // Йотовая палатализация r -> rj / r' в 1sg презенса
    assert('govoriti: Наличие йотовой палатализации в форме 1sg (govorljų)', findForm(govoritiForms, { verbForm: 'fin', person: '1', number: 'sg', tense: 'pres' })?.startsWith('govorlj') === true);


    // =========================================================================
    // 3. ТЕСТЫ ПРИЛАГАТЕЛЬНЫХ (ADJ)
    // =========================================================================
    console.log('\n--- 3. Прилагательные (ADJ) ---');

    // Пример А: "novy" (Качественное прилагательное, Парадигма C)
    const adjNovy: EngineWordInput = {
        id: 5, slug: 'novy-adj', isv: 'novy', pos: 'ADJ',
        paradigm: AccentParadigm.C, protoStemClass: ProtoStemClass.O_SHORT
    };
    const novyForms = processAdjective(adjNovy);
    // 63 базовые формы + 63 компаратив + 63 суперлатив = 189 словоформ
    assert('novy: Качественное прилагательное разворачивает все три степени сравнения (189 форм)', novyForms.length === 189);
    assert('novy: Компаратив успешно образует праславянский мягкий суффикс с долгим акутом (nově́jšy)', findForm(novyForms, { case: 'nominative', number: 'sg', gender: 'masc', degree: 'comp' }) === 'nove\u0301jšy');

    // Пример Б: "kamienny" (Относительное прилагательное, Парадигма A)
    const adjKamienny: EngineWordInput = {
        id: 6, slug: 'kamienny-adj', isv: 'kamienny', pos: 'ADJ',
        paradigm: AccentParadigm.A, protoStemClass: ProtoStemClass.O_SHORT
    };
    const kamiennyForms = processAdjective(adjKamienny);
    assert('kamienny: Относительное прилагательное генерирует ТОЛЬКО базовую степень сравнения (63 формы)', kamiennyForms.length === 63);


    // =========================================================================
    // 4. ТЕСТЫ ЧИСЛИТЕЛЬНЫХ (NUM)
    // =========================================================================
    console.log('\n--- 4. Числительные (NUM) ---');

    // Пример А: "dva" (Количественное числительное подкласса 2-4, Парадигма C)
    const numDva: EngineWordInput = { id: 7, slug: 'dva-num', isv: 'dva', pos: 'NUM', paradigm: AccentParadigm.C };
    const dvaForms = processNumeral(numDva);
    assert('dva: Родовое разведение в им.п. для женского/среднего рода (dvě̌)', findForm(dvaForms, { case: 'nominative', gender: 'fem' }) === 'dve\u0302');

    // Пример Б: "pęty" (Порядковое числительное, Парадигма A)
    const numPety: EngineWordInput = { id: 8, slug: 'pety-num', isv: 'pęty', pos: 'NUM', paradigm: AccentParadigm.A };
    const petyForms = processNumeral(numPety);
    assert('pęty: Порядковое числительное успешно проксируется в адъективный движок (63 формы)', petyForms.length === 63);


    // =========================================================================
    // 5. ТЕСТЫ МЕСТОИМЕНИЙ (PRON) & ОПРЕДЕЛИТЕЛЕЙ (DET)
    // =========================================================================
    console.log('\n--- 5. Местоимения и Определители (PRON / DET) ---');

    // Местоимение "ja" (Личное местоимение, Парадигма C)
    const pronJa: EngineWordInput = { id: 9, slug: 'ja-pron', isv: 'ja', pos: 'PRON', paradigm: AccentParadigm.C };
    const jaForms = processPronoun(pronJa);
    // Проверяем полную ударную форму и энклитическую безударную
    assert('ja: Наличие полной ударной формы в дат.п. (mené)', findForm(jaForms, { case: 'dative', number: 'sg', degree: 'full' as any }) === 'mene\u0301');
    assert('ja: Наличие энклитической безударной формы в дат.п. без диакритики (mi)', findForm(jaForms, { case: 'dative', number: 'sg', degree: 'short' as any }) === 'mi');


    // =========================================================================
    // 6. ТЕСТЫ НАРЕЧИЙ (ADV) & ВСПОМОГАТЕЛЬНЫХ СИСТЕМ (AUX / UNINFLECTED)
    // =========================================================================
    console.log('\n--- 6. Наречия и Служебные категории (ADV / AUX / PUNCT) ---');

    // Наречие "dobro" (Качественное наречие)
    const advDobro: EngineWordInput = { id: 10, slug: 'dobro-adv', isv: 'dobro', pos: 'ADV' };
    const dobroForms = processAdverb(advDobro);
    assert('dobro: Наличие компаратива (dobrě́je)', findForm(dobroForms, { degree: 'comp' }) === 'dobre\u0301je');
    assert('dobro: Наличие суперлатива с префиксом (najdobrě́je)', findForm(dobroForms, { degree: 'sup' }) === 'najdobre\u0301je');

    // Вспомогательный глагол "byti" (AUX)
    const auxByti: EngineWordInput = { id: 11, slug: 'byti-aux', isv: 'byti', pos: 'AUX' };
    const bytiForms = processAuxiliary(auxByti);
    assert('byti: Автоматическое развертывание супплетивной атематической сетки настоящего времени (jest)', bytiForms.some(f => f.surfaceForm === 'jest' && f.feats.tense === 'pres'));

    // Знак препинания (PUNCT)
    const punctDot: EngineWordInput = { id: 12, slug: 'dot-punct', isv: '.', pos: 'PUNCT' };
    const dotForms = processUninflected(punctDot);
    assert('punct: Служебный инвариант возвращает неизмененный символ без грамматических признаков', dotForms[0].surfaceForm === '.' && Object.keys(dotForms[0].feats).length === 0);

    // =========================================================================
    // ФИНАЛЬНЫЙ СЧЕТЧИК
    // =========================================================================
    console.log('\n=========================================================================');
    console.log(`📊 ИТОГИ ТЕСТИРОВАНИЯ: Успешно выполнено ${passedTests} из ${totalTests} тестов.`);
    console.log('=========================================================================');
}
