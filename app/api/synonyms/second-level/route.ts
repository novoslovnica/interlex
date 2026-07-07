import {NextResponse} from "next/server";
import {init} from "@/lib/sqlite";

export async function POST(request: Request) {
    try {
        const {lexemeIds} = await request.json() as { lexemeIds: number[] };

        if (!lexemeIds?.length) return NextResponse.json({});

        const placeholders = lexemeIds.map(() => '?').join(',');

        const db = await init();
        const rows = db.prepare(`
            SELECT ml.lexemeId as sourceLexemeId,
                   s.targetId as targetMeaningId,
                   m.meaning as targetMeaning,
                   w.value as targetWord,
                   w.id as targetWordId
            FROM synonyms s
            JOIN meanings ml ON ml.id = s.sourceId
            JOIN meanings m ON m.id = s.targetId
            JOIN lexemes w ON w.id = m.lexemeId
            WHERE ml.lexemeId IN (${placeholders})
        `).all(...lexemeIds) as any[];

        const grouped: Record<number, any[]> = {};
        for (const row of rows) {
            if (!grouped[row.sourceLexemeId]) grouped[row.sourceLexemeId] = [];
            if (!grouped[row.sourceLexemeId].some((r: any) => r.targetWordId === row.targetWordId)) {
                grouped[row.sourceLexemeId].push(row);
            }
        }

        return NextResponse.json(grouped);
    } catch (error) {
        return NextResponse.json({error: "Internal Error"}, {status: 500});
    }
}