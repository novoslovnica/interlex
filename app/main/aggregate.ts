import {prismaData as db } from "@/lib/prisma";

const standardCore = { flavor: { code: "CORE" }, type: "standard", value: { not: "" } };
const eligibleWord = { isPublic: true, lexemeAllophones: { some: standardCore } };

export interface RandomWordResult {
    id: number;
    isv: string;
    pos: string | null;
    meanings: {
        id: number;
        translations: { id: number; language: string; value: string | null }[];
    }[];
}

async function fetchRandomWordWithAllophones(randomId: number): Promise<RandomWordResult | null> {
    const word = await db.lexeme.findFirst({
        where: { ...eligibleWord, id: { gte: randomId } },
        orderBy: { id: "asc" },
        select: {
            id: true,
            pos: true,
            lexemeAllophones: {
                where: standardCore,
                select: { value: true },
                take: 1,
            },
            meanings: {
                select: {
                    id: true,
                    translations: {
                        where: { language: { in: ['ru', 'en'] } },
                        select: { id: true, language: true, value: true },
                    },
                },
            },
        },
    });

    const isv = word?.lexemeAllophones[0]?.value.trim();
    if (!word || !isv) return null;

    return {
        id: word.id,
        isv,
        pos: word.pos,
        meanings: word.meanings,
    };
}

export async function getRandomWordWithTranslations(): Promise<RandomWordResult | null> {
    const aggregations = await db.lexeme.aggregate({
        where: eligibleWord,
        _max: { id: true },
    });

    const maxId = aggregations._max.id;
    if (!maxId) return null;

    const randomId = Math.floor(Math.random() * maxId) + 1;

    const randomWord = await fetchRandomWordWithAllophones(randomId);

    // An edit between the queries can leave the upper range empty.
    return randomWord ?? fetchRandomWordWithAllophones(0);
}
