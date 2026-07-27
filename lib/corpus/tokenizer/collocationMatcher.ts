import { etymCyrToEtymLat } from '@/lib/transliteration';

export interface CollocationRecord {
    wordSlug: string;
    lemma: string;
    pos: string;
}

const MAX_SPAN = 4;

function normalizeToken(token: string): string {
    let clean = token.toLowerCase();
    if (/[а-яѢѣѦѧѪѫ]/i.test(clean)) {
        clean = etymCyrToEtymLat(clean);
    }
    return clean;
}

/**
 * Точное (по нормализованной форме) сопоставление многословных лексем
 * (Lexeme.isCollocation=true) с последовательностями поверхностных токенов —
 * без учёта словоизменения компонентов внутри фразы (см. план
 * unified-herding-lightning.md, п. 1e). Без этого прохода такие лексемы
 * структурно невидимы для DbAnalyzer, который сопоставляет по одному токену.
 */
export class CollocationMatcher {
    private byPhrase: Map<string, CollocationRecord>;

    constructor(collocations: CollocationRecord[]) {
        this.byPhrase = new Map();
        for (const c of collocations) {
            this.byPhrase.set(normalizeToken(c.lemma).trim(), c);
        }
    }

    /** Жадно пробует фразы длиной от min(MAX_SPAN, остаток) до 2 токенов, начиная с surfaceTokens[startIndex]. */
    matchAt(surfaceTokens: string[], startIndex: number): { length: number; record: CollocationRecord } | null {
        const maxLen = Math.min(MAX_SPAN, surfaceTokens.length - startIndex);
        for (let len = maxLen; len >= 2; len--) {
            const phrase = surfaceTokens
                .slice(startIndex, startIndex + len)
                .map(normalizeToken)
                .join(' ');
            const record = this.byPhrase.get(phrase);
            if (record) return { length: len, record };
        }
        return null;
    }
}
