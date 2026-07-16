import {NextRequest, NextResponse} from "next/server";
import {updateField} from "@/app/api/lexicon/[id]/updateField/service";
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"

interface RouteParams {
    params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, ctx: RouteParams) {
    const session = await auth()
    if (!await checkPermission(session, Feature.WordsEdit)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await ctx.params;

    const body = await request.json();

    const result = await updateField(id, body.field, body.newValue, body.veryfied, body.translationId, body.message, body.meaningId);

    return NextResponse.json(result, {
        status: 200,
    });
}
