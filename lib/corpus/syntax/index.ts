export { parseSentence, dedupeByDepToken } from './parser';
export { parseComplexSentence, baseLemma } from './complexSentence';
export { sentenceToConllU, documentToConllU } from './conllu';
export type { ConlluSentenceInput } from './conllu';
export { saveDependencies } from './persist';
export { isSimpleClause } from './clause';
export { chunkNounPhrases } from './npChunker';
export type { NounPhrase } from './npChunker';
export { UD_DEPREL } from './deprel';
export type { UdDeprel } from './deprel';
export type { SyntaxToken, DependencyEdge, DependencyConfidence } from './types';
export {
    PREPOSITION_GOVERNMENT,
    getExpectedCasesForPreposition,
    getVerbGovernment,
    loadVerbGovernmentOverridesSync,
    resetVerbGovernmentCache,
} from './government';
export type { VerbGovernmentEntry, VerbGovernmentRole } from './government';
export { normalizeCase } from './caseUtils';
export { localPredicateFor, findNominalCoordinationTarget } from './coordination';
export type { CoordinationTarget } from './coordination';
