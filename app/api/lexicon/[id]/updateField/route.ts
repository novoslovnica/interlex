import {NextRequest, NextResponse} from "next/server";
import {updateField} from "@/app/api/lexicon/[id]/updateField/service";
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { TRANSLATION_LANGUAGE_CODES } from "@/lib/translations"

interface RouteParams {
    params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, ctx: RouteParams) {
    const session = await auth()

    const { id } = await ctx.params;

    const body = await request.json();

    const lang = typeof body.field === "string" ? body.field.toLowerCase() : ""
    const isTranslationField = (TRANSLATION_LANGUAGE_CODES as readonly string[]).includes(lang)

    // Translation edits (the translation table and translation-cards) are
    // gated per-language via `translate_${lang}`, a lower-tier permission a
    // moderator can hold without also having `words_edit` (full lexeme
    // editing) — checking WordsEdit here for every field, translations
    // included, blocked exactly that group from saving despite the page
    // itself correctly gating on dictionary_edit/translate_${lang}.
    const requiredFeature = isTranslationField
        ? (`translate_${lang}` as Feature)
        : Feature.WordsEdit

    if (!await checkPermission(session, requiredFeature)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await updateField(id, body.field, body.newValue, body.verified, body.translationId, body.message, body.meaningId);

    return NextResponse.json(result, {
        status: 200,
    });
}
