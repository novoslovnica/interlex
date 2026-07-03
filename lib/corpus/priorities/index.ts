export { runColdStart } from './coldStart';
export { recalculateWordFormPriorities } from './hotUpdate';
export { loadPriorityDictionary } from './dictionaryLoader';
export type {
    FormDistributionItem,
    PriorityDictionaryEntry,
    PriorityDictionary,
} from './types';
export { isValidDistribution, CASE_WEIGHTS } from './types';
