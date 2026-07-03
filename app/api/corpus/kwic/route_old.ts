import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { KwicResponse, KwicMatch } from '@/types/corpus';

const prisma = new PrismaClient();

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);

        const query = searchParams.get('query')?.trim();
        const type = searchParams.get('type') || 'lemma'; // 'lemma' | 'surface'
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10)));

        if (!query) {
            return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
        }

        // Формируем условие фильтрации в зависимости от типа поиска
        const whereCondition = type === 'surface'
            ? { surfaceForm: { equals: query, mode: 'insensitive' as const } }
            : { lemma: { equals: query, mode: 'insensitive' as const } };

        // 1. Получаем общее количество совпадений для пагинации
        const totalMatches = await prisma.corpusToken.count({
            where: whereCondition,
        });

        if (totalMatches === 0) {
            return NextResponse.json<KwicResponse>({
                matches: [],
                pagination: { total: 0, page, pageSize, totalPages: 0 }
            });
        }

        // 2. Выбираем токены-попадания с пагинацией, подтягивая связанные предложения
        const tokens = await prisma.corpusToken.findMany({
            where: whereCondition,
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                sentence: true, // Забираем rawText предложения
            },
            orderBy: {
                id: 'asc', // Гарантирует стабильный порядок выдачи
            },
        });

        // 3. Формируем KWIC-структуру (сплитуем предложение вокруг найденного токена)
        const matches: KwicMatch[] = tokens.map((token) => {
            const fullText = token.sentence.rawText;
            const word = token.surfaceForm;

            // Ищем точное вхождение слова в предложении.
            // Во избежание ложных срабатываний (если слово дублируется),
            // в идеальном корпусе позиция берется по символьному offset.
            // Здесь используем безопасный сплит по первому вхождению для демонстрации:
            const wordIndex = fullText.indexOf(word);

            let leftContext = '';
            let rightContext = '';

            if (wordIndex !== -1) {
                leftContext = fullText.substring(0, wordIndex);
                rightContext = fullText.substring(wordIndex + word.length);
            } else {
                // Фоллбэк, если точное совпадение регистра смазалось
                leftContext = fullText;
            }

            return {
                tokenId: token.id.toString(), // Конвертируем BigInt в String для JSON
                documentSlug: token.documentSlug,
                sentenceId: token.sentenceId,
                leftContext: leftContext.trimEnd(),
                keyword: word,
                rightContext: rightContext.trimStart(),
            };
        });

        const totalPages = Math.ceil(totalMatches / pageSize);

        return NextResponse.json<KwicResponse>({
            matches,
            pagination: {
                total: totalMatches,
                page,
                pageSize,
                totalPages,
            },
        });

    } catch (error) {
        console.error('KWIC generation error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
