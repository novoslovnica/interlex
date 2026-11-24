import { NextResponse } from "next/server";
import { getLexiconSuggestions } from "../services";

export async function GET(request: Request) {
    const {searchParams} = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const mainCategory = searchParams.get("mainCategory") ?? "";
    const usageType = searchParams.get("usageType") ?? "";
    if ([query, mainCategory, usageType].some(value => value.length > 100 || value.includes("\0"))) {
        return NextResponse.json({error: "Invalid search parameters"}, {status: 400});
    }
    return NextResponse.json(await getLexiconSuggestions(query, mainCategory, usageType));
}
