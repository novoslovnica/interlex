import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { CqlParser } from '@/utils/cqlParser';
import { CqlTranslator } from '@/utils/cqlTranslator';
import { CqlKwicResponse, CqlKwicMatch, RawCqlQueryResult } from '@/types/corpus';

const prisma = new PrismaClient();

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const cqlQuery = searchParams.get('cql')?.trim();
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10)));

        if (!cqlQuery) {
            return NextResponse.json({ error: 'Parameter "cql" is required' }, { status: 400 });
        }

        // 1. Парсинг и трансляция CQL в SQL-шаблон
        const ast = CqlParser.parse(cqlQuery);
        const { query, params } = CqlTranslator.toSQL(ast);

        // 2. Модификация SQL под пагинацию (LIMIT и OFFSET)
        // Дописываем безопасный синтаксис лимитов для SQLite/PostgreSQL
        const offset = (page - 1) * pageSize;
        const paginatedQuery = `${query} LIMIT ${pageSize + 1} OFFSET ${offset}`;

        // 3. Выполнение Raw-запроса в Analytics DB через Prisma
        const rawMatches = await prisma.$queryRawUnsafe<RawCqlQueryResult[]>(
            paginatedQuery,
            ...params
        );

        if (rawMatches.length === 0) {
            return NextResponse.json<CqlKwicResponse>({
                matches: [],
                pagination: { page, pageSize, hasMore: false }
            });
        }

        // Проверяем, есть ли данные на следующую страницу (запросили pageSize + 1)
        const hasMore = rawMatches.length > pageSize;
        const currentResults = hasMore ? rawMatches.slice(0, pageSize) : rawMatches;

        // 4. Оптимизация сборки контекста: собираем все уникальные sentenceId
        const uniqueSentenceIds = Array.from(new Set(currentResults.map(r => r.sentenceId)));

        // Извлекаем сырые тексты предложений и все их токены одним запросом
        const sentencesData = await prisma.corpusSentence.findMany({
            where: { id: { in: uniqueSentenceIds } },
            include: {
                tokens: {
                    orderBy: { tokenIndex: 'asc' }
                }
            }
        });

        // Мапим для быстрого O(1) доступа
        const sentencesMap = new Map(sentencesData.map(s => [s.id, s]));

        // 5. Построение KWIC структуры на основе точных индексов совпадения
        const matches: CqlKwicMatch[] = currentResults.map((rawMatch) => {
            const sentence = sentencesMap.get(rawMatch.sentenceId);

            if (!sentence) {
                // Фоллбэк на случай нарушения целостности данных
                return {
                    matchId: `${rawMatch.sentenceId}_${rawMatch.matchStart}`,
                    documentSlug: rawMatch.documentSlug,
                    sentenceId: rawMatch.sentenceId,
                    leftContext: '',
                    keyword: 'Match Not Found',
                    rightContext: ''
                };
            }

            // Находим токены, которые попали в диапазон запроса, и контекст вокруг них
            const leftTokens: string[] = [];
            const keywordTokens: string[] = [];
            const rightTokens: string[] = [];

            sentence.tokens.forEach((token) => {
                if (token.tokenIndex < rawMatch.matchStart) {
                    leftTokens.push(token.surfaceForm);
                } else if (token.tokenIndex >= rawMatch.matchStart && token.tokenIndex <= rawMatch.matchEnd) {
                    keywordTokens.push(token.surfaceForm);
                } else {
                    rightTokens.push(token.surfaceForm);
                }
            });

            // Функция сборки строки, корректно обрабатывающая пробелы перед знаками препинания
            const joinTokens = (tokens: string[]): string => {
                return tokens.reduce((acc, token) => {
                    // Если токен — пунктуация, прижимаем его к предыдущему слову без пробела
                    if (/^[.,!?;:»" font-mono]+$/.test(token) || acc === '') {
                        return acc + token;
                    }
                    return acc + ' ' + token;
                }, '');
            };

            return {
                matchId: `${rawMatch.sentenceId}_${rawMatch.matchStart}`,
                documentSlug: rawMatch.documentSlug,
                sentenceId: rawMatch.sentenceId,
                leftContext: joinTokens(leftTokens),
                keyword: joinTokens(keywordTokens),
                rightContext: joinTokens(rightTokens),
            };
        });

        return NextResponse.json<CqlKwicResponse>({
            matches,
            pagination: {
                page,
                pageSize,
                hasMore
            }
        });

    } catch (error) {
        console.error('CQL KWIC execution error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
