import { PriorityDictionary, PriorityDictionaryEntry, FormDistributionItem } from '../priorities/types';
import { applyContextRules, TokenContext } from './contextRules';

export class DisambiguationEngine {
    private dictionary: PriorityDictionary;

    constructor(dictionary: PriorityDictionary) {
        this.dictionary = dictionary;
    }

    public resolve(context: TokenContext): PriorityDictionaryEntry | null {
        const normalizedForm = context.currentForm.toLowerCase().trim();
        const options = this.dictionary.get(normalizedForm);

        if (!options || options.length === 0) return null;

        if (options.length === 1) return options[0];

        const distributionItems: FormDistributionItem[] = options.map(opt => ({
            slug: opt.lemmaSlug,
            pos: opt.pos,
            case: opt.feats['case'] as FormDistributionItem['case'],
            freq: opt.priority,
        }));

        const contextMatch = applyContextRules(context, distributionItems);
        if (contextMatch) {
            const matched = options.find(
                opt => opt.lemmaSlug === contextMatch.slug && opt.priority === contextMatch.freq
            );
            if (matched) return matched;
        }

        return options[0];
    }
}