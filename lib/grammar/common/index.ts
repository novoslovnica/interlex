export { PosType, ALL_POS_VALUES, isValidPos } from './pos';
export { GrammaticalGender } from './gender';
export { VerbalAspect } from './aspect';
export { AccentParadigm } from './paradigm';
export { ProtoStemClass, StemExtension } from './stem';
export { GrammaticalCase, isValidCase, ALL_CASE_VALUES } from './case';
export { GrammaticalNumber, isValidNumber, ALL_NUMBER_VALUES } from './number';
export type { MorphoGrammarFeats } from './feats';
export { csvGrammarMapper } from './import-mapper';
export type { CsvGrammarFields } from './import-mapper';
export { heuristicStem } from './heuristicStem';

export function isEnumMatch<T extends Record<string, string>>(
    value: string | null | undefined,
    enumObject: T
): value is T[keyof T] {
    if (!value) return false;
    return Object.values(enumObject).includes(value as T[keyof T]);
}

export type AdjectiveTypeClass = 'relative' | 'qualitative';