import {NextRequest, NextResponse} from "next/server";
import {getReverseDictItems} from "@/app/api/lexicon/services";
import {auth} from "@/auth";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const params = new URLSearchParams(url.searchParams);
    const query = params.get('search') || "";
    const lang = params.get('lang') || "";
    const offset = params.get('offset') || 0;
    const limit = params.get('limit') || 50;

    const session = await auth();
    const includeHidden = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR';

    const dicts = await getReverseDictItems(
        query,
        lang,
        Number(offset),
        Number(limit),
        includeHidden,
    );

    return NextResponse.json(dicts, {
        status: 200,
    });
}
