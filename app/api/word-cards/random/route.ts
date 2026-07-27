import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { Feature } from "@/config/features";
import { init } from "@/lib/sqlite";
import { fetchTranslationsForMeaning } from "@/lib/translations";

/**
 * Аналог /api/translation-cards/random, но для верификации самой лексемы
 * (флаворизация CORE — см. AGENTS.md/lexeme_allophones), а не переводов.
 * Каждая лексема имеет ровно одну CORE-строку в lexeme_allophones (100%
 * покрытие на 2026-07-28), поэтому здесь достаточно простого JOIN без
 * fallback-на-Lexeme.value.
 */
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!await checkPermission(session, Feature.WordsEdit)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = await init();

    const row = db.prepare(`
        SELECT l.id as lexemeId, l.value, l.slug, l.pos, la.id as allophoneId, la.value as coreValue
        FROM lexemes l
        JOIN lexeme_allophones la ON la.lexemeId = l.id
        JOIN allophone_flavors af ON af.id = la.flavorId
        WHERE af.code = 'CORE' AND la.type = 'standard' AND (la.verified IS NULL OR la.verified != 1)
        ORDER BY RANDOM() LIMIT 1
    `).get() as { lexemeId: number; value: string | null; slug: string | null; pos: string | null; allophoneId: number; coreValue: string } | undefined;

    if (!row) {
        return NextResponse.json({ done: true });
    }

    const meaning = db.prepare(`
        SELECT id, meaning, examples FROM meanings WHERE lexemeId = ? ORDER BY id ASC LIMIT 1
    `).get(row.lexemeId) as { id: number; meaning: string | null; examples: string | null } | undefined;

    const ru = meaning ? fetchTranslationsForMeaning(db, meaning.id, "ru") : [];
    const en = meaning ? fetchTranslationsForMeaning(db, meaning.id, "en") : [];

    return NextResponse.json({
        done: false,
        lexeme: { id: row.lexemeId, value: row.value, slug: row.slug, pos: row.pos },
        allophoneId: row.allophoneId,
        coreValue: row.coreValue,
        meaningText: meaning?.meaning ?? null,
        examples: meaning?.examples ?? null,
        ru,
        en,
    });
}
