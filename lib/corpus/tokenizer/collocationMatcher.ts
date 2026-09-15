import { etymCyrToEtymLat, isCyrillic } from '@/lib/transliteration';

export interface CollocationRecord {
    wordSlug: string;
    lemma: string;
    pos: string;
}

const MAX_SPAN = 4;

function normalizeToken(token: string): string {
    let clean = token.toLowerCase();
    if (isCyrillic(clean)) {
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
// Слитное написание двухсловного словосочетания одним токеном: "daby" = "da by"
// (1 374 вхождения), "akoli" = "ako li". Короче 4 букв не берём — склейки
// вроде "no i" -> "noi" совпадали бы с чем попало.
const MIN_JOINED_LENGTH = 4;

export class CollocationMatcher {
    private byPhrase: Map<string, CollocationRecord>;
    private byJoined: Map<string, CollocationRecord>;

    constructor(collocations: CollocationRecord[]) {
        this.byPhrase = new Map();
        this.byJoined = new Map();
        for (const c of collocations) {
            const phrase = normalizeToken(c.lemma).trim();
            this.byPhrase.set(phrase, c);
            const words = phrase.split(/\s+/);
            const joined = words.join('');
            if (words.length === 2 && joined.length >= MIN_JOINED_LENGTH && !this.byJoined.has(joined)) {
                this.byJoined.set(joined, c);
            }
        }
    }

    /** Словосочетание, написанное одним токеном без пробела. */
    matchJoined(surfaceToken: string): { length: number; record: CollocationRecord } | null {
        const record = this.byJoined.get(normalizeToken(surfaceToken));
        return record ? { length: 1, record } : null;
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
