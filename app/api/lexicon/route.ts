import {parseLexiconPagination, LexiconPaginationError} from "@/lib/lexiconPagination";
import {NextRequest, NextResponse} from "next/server";
import {getDictItems} from "@/app/api/lexicon/services";
import {auth} from "@/auth";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const params = new URLSearchParams(url.searchParams);
    const query = params.get('search') || "";
    let pagination;
    try {
        pagination = parseLexiconPagination(params);
    } catch (error) {
        if (error instanceof LexiconPaginationError) {
            return NextResponse.json({error: error.message}, {status: 400});
        }
        throw error;
    }
    const mainCategory = params.get('mainCategory') || '';
    const usageType = params.get('usageType') || '';
    const filterLang = params.get('filterLang') || '';
    const unverified = params.get('unverified') || '';
    const unverifiedMeanings = params.get('unverifiedMeanings') || '';
    const unverifiedCore = params.get('unverifiedCore') || '';
    const unverifiedNsl = params.get('unverifiedNsl') || '';

    const session = await auth();
    const includeHidden = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR';

    const dicts = await getDictItems(
        query,
        pagination.offset,
        pagination.limit,
        mainCategory,
        usageType,
        filterLang,
        unverified === '1',
        includeHidden,
        unverifiedMeanings === '1',
        unverifiedCore === '1',
        unverifiedNsl === '1',
    );

    return NextResponse.json(dicts, {
        status: 200,
    });
}
