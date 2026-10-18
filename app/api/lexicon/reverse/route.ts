import {parseLexiconPagination, LexiconPaginationError} from "@/lib/lexiconPagination";
import {NextRequest, NextResponse} from "next/server";
import {getReverseDictItems} from "@/app/api/lexicon/services";
import {auth} from "@/auth";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const params = new URLSearchParams(url.searchParams);
    const query = params.get('search') || "";
    const lang = params.get('lang') || "";
    let pagination;
    try {
        pagination = parseLexiconPagination(params);
    } catch (error) {
        if (error instanceof LexiconPaginationError) {
            return NextResponse.json({error: error.message}, {status: 400});
        }
        throw error;
    }

    const session = await auth();
    const includeHidden = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR';

    const dicts = await getReverseDictItems(
        query,
        lang,
        pagination.offset,
        pagination.limit,
        includeHidden,
    );

    return NextResponse.json(dicts, {
        status: 200,
    });
}
