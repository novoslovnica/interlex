import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { Feature } from "@/config/features";
import { init } from "@/lib/sqlite";
import { fetchTranslationsForMeaning, TRANSLATION_LANGUAGE_CODES } from "@/lib/translations";

const LANG_CODES: readonly string[] = TRANSLATION_LANGUAGE_CODES;

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
        SELECT m.id as meaningId, m.meaning, m.examples, m.lexemeId
        FROM meanings m
        WHERE NOT EXISTS (
            SELECT 1 FROM translations t
            WHERE t.meaningId = m.id AND t.language = ? AND t.verified = 1
        )
        ORDER BY RANDOM() LIMIT 1
    `).get(lang) as { meaningId: number; meaning: string | null; examples: string | null; lexemeId: number } | undefined;

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

    const ruRow = fetchTranslationsForMeaning(db, row.meaningId, "ru");
    const enRow = fetchTranslationsForMeaning(db, row.meaningId, "en");
    const targetRows = fetchTranslationsForMeaning(db, row.meaningId, lang);

    return NextResponse.json({
        done: false,
        lexeme,
        meaningId: row.meaningId,
        meaningText: row.meaning,
        examples: row.examples,
        ru: ruRow,
        en: enRow,
        target: targetRows,
    });
}