import {NextRequest, NextResponse} from "next/server";
import {getDictItems} from "@/app/api/lexicon/services";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const params = new URLSearchParams(url.searchParams);
    const query = params.get('search') || "";
    const offset = params.get('offset') || 0;
    const limit = params.get('limit') || 0;

    const dicts = await getDictItems(query, offset, limit);

    return NextResponse.json(dicts, {
        status: 200,
    });
}
