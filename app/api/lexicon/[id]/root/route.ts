import {NextRequest, NextResponse} from "next/server";
import {getRoots} from "@/app/api/lexicon/[id]/root/service";

export async function GET(request: NextRequest, ctx: RouteContext<'/users/[id]'>) {
    const { id } = await ctx.params

    const dicts = await getRoots(id);

    return NextResponse.json(dicts, {
        status: 200,
    });
}
