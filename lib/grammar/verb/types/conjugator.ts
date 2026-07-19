export type InterslavicAspect = 'perfective' | 'imperfective' | 'bi-aspectual';

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
    // Если совершенный вид -> значение Будущего, если несовершенный -> Настоящее
    presentOrFutureDirect: FullParadigm;
    // Аналитическое будущее (для несовершенного вида: буду/хочу/имам + инфинитив)
    futureAnalytical?: {
        withByti: FullParadigm;
        withImati: FullParadigm;
        withHtěti: FullParadigm;
    };
    // 4 прошедших времени
    aorist: FullParadigm;
    imperfect: FullParadigm;
    perfect: {
        masculine: FullParadigm;
        feminine: FullParadigm;
        neuter: FullParadigm;
        plural: FullParadigm; // Для упрощения вывода связки "есмь/еси" + L-форма
    };
    pluperfect: {
        masculine: FullParadigm;
        feminine: FullParadigm;
    };
}

export interface ConjugationResult {
    infinitive: string;
    verbClass: ProtoSlavicClass;
    aspect: InterslavicAspect;
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
    infinitive: string;       // Например, "nesti"
    infStem: string;          // Основа инфинитива ("nes-")
    presentStem: string;      // Основа презенса ("nese-")
    aoristStem: string;       // Основа аориста ("nes-")
    tertiaryStem?: string;    // Основа l-причастия ("š-", "by-")
    verbClass: ProtoSlavicClass;
    aspect: InterslavicAspect;
    paradigm?: string;        // Accent paradigm: 'A' | 'B' | 'C'
}
