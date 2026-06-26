import {NextRequest, NextResponse} from "next/server";
import {getDictItems} from "@/app/api/dict/services";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const params = new URLSearchParams(url.searchParams);
    const query = params.get('search');
    const from = params.get('from');
    const to = params.get('to');

    if (!query) {
        return NextResponse.json(null, {
            status: 400,
        });
    }
    const dicts = await getDictItems(query, from, to);

    return NextResponse.json(dicts, {
        status: 200,
    });
}
