import {NextRequest, NextResponse} from "next/server";
import {updateField} from "@/app/api/lexicon/[id]/updateField/service";

interface RouteParams {
    params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, ctx: RouteParams) {
    const { id } = await ctx.params;

    const body = await request.json();

    await updateField(id, body.field, body.newValue);

    return NextResponse.json(null, {
        status: 200,
    });
}
