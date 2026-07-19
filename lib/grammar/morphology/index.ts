export interface MorphoGrammarFeats {
    case?: 'nom' | 'gen' | 'dat' | 'acc' | 'ins' | 'loc' | 'voc';
    number?: 'sg' | 'du' | 'pl';
    gender?: 'masc' | 'fem' | 'neut';
    animacy?: 'anim' | 'inanim';
    person?: '1' | '2' | '3';
    tense?: 'pres' | 'past' | 'fut' | 'aor' | 'impf';
    mood?: 'ind' | 'imp' | 'sub';
    voice?: 'act' | 'pass';
    verbForm?: 'inf' | 'fin' | 'part' | 'ger';
    degree?: 'pos' | 'comp' | 'sup';
}

export interface GeneratedForm {
    surfaceForm: string;
    accentedForm?: string;
    feats: MorphoGrammarFeats;
}

export interface EngineWordInput {
    id: number;
    slug: string;
    isv: string | null;
    pos: string | null;
    protoStemClass?: string | null;
    stemExtension?: string | null;
    paradigm?: string | null;
    stem?: string | null;
    secondaryStem?: string | null;
    tertiaryStem?: string | null;
    gender?: string | null;
    alternationType?: string | null;
    fleetingVowelAt?: number | null;
    flavor?: string;
}
