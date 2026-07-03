export enum PosType {
    NOUN  = 'NOUN',  // Substantive
    PROPN = 'PROPN', // Proper Noun
    VERB  = 'VERB',  // Verb
    AUX   = 'AUX',   // Auxiliary Verb
    ADJ   = 'ADJ',   // Adjective
    PRON  = 'PRON',  // Pronoun
    DET   = 'DET',   // Determiner
    NUM   = 'NUM',   // Numeral
    ADV   = 'ADV',   // Adverb
    ADP   = 'ADP',   // Adposition (Preposition)
    CCONJ = 'CCONJ', // Coordinating Conjunction
    SCONJ = 'SCONJ', // Subordinating Conjunction
    PART  = 'PART',  // Particle
    INTJ  = 'INTJ',  // Interjection
    PUNCT = 'PUNCT', // Punctuation
    SYM   = 'SYM',   // Symbol
    X     = 'X'      // Other / Foreign
}

// Удобный массив всех доступных значений для валидаторов (например, в Zod)
export const ALL_POS_VALUES = Object.values(PosType) as string[];

/**
 * Type Guard для проверки строковых значений из базы данных
 */
export function isValidPos(pos: string | null | undefined): pos is PosType {
    if (!pos) return false;
    return ALL_POS_VALUES.includes(pos.toUpperCase());
}
