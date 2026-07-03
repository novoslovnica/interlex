export interface KwicMatch {
    tokenId: string;
    documentSlug: string;
    sentenceId: string;
    leftContext: string;
    keyword: string;
    rightContext: string;
}

export interface KwicResponse {
    matches: KwicMatch[];
    pagination: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}

export interface CqlKwicMatch {
    matchId: string;        // Уникальный ID совпадения (комбинация sentenceId + start)
    documentSlug: string;
    sentenceId: string;
    leftContext: string;    // Контекст слева от всей фразы
    keyword: string;        // Вся найденная фраза (может быть несколько слов)
    rightContext: string;   // Контекст справа от всей фразы
}

export interface CqlKwicResponse {
    matches: CqlKwicMatch[];
    pagination: {
        page: number;
        pageSize: number;
        // При сложных динамических JOIN raw-запросах точный count всех строк
        // может быть избыточно тяжелым. Делаем стандартную пагинацию по факту.
        hasMore: boolean;
    };
}

// Интерфейс строки, возвращаемой транслятором SQL
export interface RawCqlQueryResult {
    sentenceId: string;
    documentSlug: string;
    matchStart: number;
    matchEnd: number;
}
