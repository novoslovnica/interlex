import { GrammaticalCase } from './case';
import { GrammaticalNumber } from './number';
import { GrammaticalGender } from './gender';

export interface MorphoGrammarFeats {
    case?: GrammaticalCase;
    number?: GrammaticalNumber;
    gender?: GrammaticalGender;
    animacy?: 'anim' | 'inanim';
    person?: '1' | '2' | '3';
    tense?: 'pres' | 'past' | 'fut' | 'aor' | 'impf';
    mood?: 'ind' | 'imp' | 'sub';
    voice?: 'act' | 'pass';
    verbForm?: 'inf' | 'fin' | 'part' | 'ger';
    degree?: 'pos' | 'comp' | 'sup';
}