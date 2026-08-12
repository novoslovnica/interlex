import {NextResponse} from "next/server";
import {init} from "@/lib/sqlite";
import {fetchSymmetricSemanticRelations} from "@/lib/relations";

// Публичный, как и сама страница слова (app/words/[id]) и первый уровень
// синонимов, который она уже показывает без авторизации — этот эндпоинт
// добавляет только второй уровень той же самой read-only словарной
// информации, без какой-либо новой asymmetry, которую стоило бы защищать.
// Раньше требовал сессию (аудит 2026-07-22, тогда — по умолчанию для всех
// ранее-неавторизованных write/analyze эндпоинтов, без отдельной оценки
// именно этого read-only случая) — из-за этого граф синонимов падал с 401
// и крашил компонент (SynonymGraph.tsx) для анонимных посетителей.
// Rate limiting на /api/** (proxy.ts) уже защищает от злоупотребления.
export async function POST(request: Request) {
    try {
        const {lexemeIds} = await request.json() as { lexemeIds: number[] };

        if (!lexemeIds?.length) return NextResponse.json({});

        const placeholders = lexemeIds.map(() => '?').join(',');

        const db = await init();
        const meaningRows = db.prepare(`
            SELECT id AS meaningId, lexemeId FROM meanings WHERE lexemeId IN (${placeholders})
        `).all(...lexemeIds) as { meaningId: number; lexemeId: number }[];

        const meaningToLexeme = new Map<number, number>();
        for (const r of meaningRows) meaningToLexeme.set(r.meaningId, r.lexemeId);

        const relMap = fetchSymmetricSemanticRelations(db, 'synonym', meaningRows.map((r) => r.meaningId));

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