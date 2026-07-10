import {prismaData as db } from "@/lib/prisma";

interface RandomWordResult {
    id: number;
    value: string | null;
    isv: string | null;
    pos: string | null;
    meanings: {
        id: number;
        ru_mean: { id: number; value: string | null }[];
        en_mean: { id: number; value: string | null }[];
    }[];
}

async function fetchRandomWordWithAllophones(randomId: number): Promise<RandomWordResult | null> {
    const word = await db.lexeme.findFirst({
        where: { id: { gte: randomId } },
        select: {
            id: true,
            value: true,
            pos: true,
            lexemeAllophones: {
                where: { flavor: { code: 'CORE' }, type: 'standard' },
                select: { value: true },
                take: 1,
            },
            meanings: {
                select: {
                    id: true,
                    ru_mean: { select: { id: true, value: true } },
                    en_mean: { select: { id: true, value: true } },
                },
            },
        },
    });

    if (!word) return null;

    return {
        id: word.id,
        value: word.value,
        isv: word.lexemeAllophones[0]?.value ?? word.value,
        pos: word.pos,
        meanings: word.meanings,
    };
}

export async function getRandomWordWithTranslations(): Promise<RandomWordResult | null> {
    const aggregations = await db.lexeme.aggregate({
        _max: { id: true },
    });

    const maxId = aggregations._max.id;
    if (!maxId) return null;

    const randomId = Math.floor(Math.random() * maxId) + 1;

    const randomWord = await fetchRandomWordWithAllophones(randomId);

    if (!randomWord) {
        const fallback = await db.lexeme.findFirst({
            select: {
                id: true,
                value: true,
                pos: true,
                lexemeAllophones: {
                    where: { flavor: { code: 'CORE' }, type: 'standard' },
                    select: { value: true },
                    take: 1,
                },
                meanings: {
                    select: {
                        id: true,
                        ru_mean: { select: { id: true, value: true } },
                        en_mean: { select: { id: true, value: true } },
                    },
                },
            },
        });
        if (!fallback) return null;
        return {
            id: fallback.id,
            value: fallback.value,
            isv: fallback.lexemeAllophones[0]?.value ?? fallback.value,
            pos: fallback.pos,
            meanings: fallback.meanings,
        };
    }

    return randomWord;
}