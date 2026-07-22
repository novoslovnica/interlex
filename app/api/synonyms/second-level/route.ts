import {NextResponse} from "next/server";
import {init} from "@/lib/sqlite";
import {auth} from "@/auth";
import {fetchSymmetricRelations} from "@/lib/relations";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({error: "Unauthorized"}, {status: 401});

        const {lexemeIds} = await request.json() as { lexemeIds: number[] };

        if (!lexemeIds?.length) return NextResponse.json({});

        const placeholders = lexemeIds.map(() => '?').join(',');

        const db = await init();
        const meaningRows = db.prepare(`
            SELECT id AS meaningId, lexemeId FROM meanings WHERE lexemeId IN (${placeholders})
        `).all(...lexemeIds) as { meaningId: number; lexemeId: number }[];

        const meaningToLexeme = new Map<number, number>();
        for (const r of meaningRows) meaningToLexeme.set(r.meaningId, r.lexemeId);

        const relMap = fetchSymmetricRelations(db, 'synonyms', meaningRows.map((r) => r.meaningId));

        const grouped: Record<number, any[]> = {};
        for (const [meaningId, related] of relMap) {
            const sourceLexemeId = meaningToLexeme.get(meaningId)!;
            if (!grouped[sourceLexemeId]) grouped[sourceLexemeId] = [];
            for (const r of related) {
                if (!grouped[sourceLexemeId].some((g: any) => g.targetWordId === r.otherWordId)) {
                    grouped[sourceLexemeId].push({
                        sourceLexemeId,
                        targetMeaningId: r.otherMeaningId,
                        targetMeaning: r.otherMeaning,
                        targetWord: r.otherWord,
                        targetWordId: r.otherWordId,
                    });
                }
            }
        }

        return NextResponse.json(grouped);
    } catch (error) {
        return NextResponse.json({error: "Internal Error"}, {status: 500});
    }
}