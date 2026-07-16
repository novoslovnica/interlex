import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { Feature } from "@/config/features";
import { init } from "@/lib/sqlite";

const LANG_CODES = ["en", "ru", "mk", "sr", "uk", "bg", "pl", "be", "cs", "sk", "sl", "hr", "hsb", "dsb", "cu", "de", "nl", "eo"];

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!await checkPermission(session, Feature.DictionaryEdit)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const lang = searchParams.get("lang");

    if (!lang || !LANG_CODES.includes(lang)) {
        return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }

    const db = await init();

    const row = db.prepare(`
        SELECT m.id as meaningId, m.meaning, m.lexemeId
        FROM meanings m
        WHERE NOT EXISTS (
            SELECT 1 FROM "${lang}" t
            WHERE t.meaningId = m.id AND t.veryfied = 1
        )
        ORDER BY RANDOM() LIMIT 1
    `).get() as { meaningId: number; meaning: string | null; lexemeId: number } | undefined;

    if (!row) {
        return NextResponse.json({ done: true });
    }

    const lexeme = db.prepare(`
        SELECT l.id, l.value, l.slug, la_core.value AS isv
        FROM lexemes l
        LEFT JOIN lexeme_allophones la_core ON la_core.lexemeId = l.id
            AND la_core.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE')
            AND la_core.type = 'standard'
        WHERE l.id = ?
    `).get(row.lexemeId) as { id: number; value: string | null; slug: string | null; isv: string | null };

    const meanings = db.prepare(`
        SELECT id, meaning, examples FROM meanings WHERE lexemeId = ?
    `).all(row.lexemeId) as { id: number; meaning: string | null; examples: string | null }[];

    const meaningIds = meanings.map(m => m.id);
    const placeholders = meaningIds.map(() => '?').join(',');

    const ruRows = db.prepare(`
        SELECT * FROM ru WHERE meaningId IN (${placeholders})
    `).all(...meaningIds) as any[];

    const enRows = db.prepare(`
        SELECT * FROM en WHERE meaningId IN (${placeholders})
    `).all(...meaningIds) as any[];

    const targetRows = db.prepare(`
        SELECT * FROM "${lang}" WHERE meaningId = ?
    `).all(row.meaningId) as any[];

    return NextResponse.json({
        done: false,
        lexeme,
        meanings,
        ru: ruRows,
        en: enRows,
        target: targetRows,
        currentMeaningId: row.meaningId,
        meaningText: row.meaning,
    });
}