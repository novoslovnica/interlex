import {NextRequest, NextResponse} from "next/server";
import {getDictItems} from "@/app/api/lexicon/services";
import {auth} from "@/auth";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const params = new URLSearchParams(url.searchParams);
    const query = params.get('search') || "";
    const offset = params.get('offset') || 0;
    const limit = params.get('limit') || 0;
    const mainCategory = params.get('mainCategory') || '';
    const usageType = params.get('usageType') || '';
    const filterLang = params.get('filterLang') || '';
    const unverified = params.get('unverified') || '';

    const session = await auth();
    const includeHidden = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR';

    const dicts = await getDictItems(
        query,
        Number(offset),
        Number(limit),
        mainCategory,
        usageType,
        filterLang,
        unverified === '1',
        includeHidden,
    );

    return NextResponse.json(dicts, {
        status: 200,
    });
}
