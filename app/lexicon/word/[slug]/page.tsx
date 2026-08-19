import {redirect} from "next/navigation";
import {init} from "@/lib/sqlite";
import {mapNslToEtymologized} from "@/lib/nsl";
import {standardToSimple} from "@/lib/isv";
import {decodeSlugParam} from "@/lib/slug";

function normalizeWord(raw: string): string {
    let word = raw.trim().toLowerCase();
    if (!word) return "";
    const hasCyrillic = /[а-яѢѣѦѧѪѫіїџђћќ]/.test(word);
    if (hasCyrillic) {
        word = mapNslToEtymologized(word) || word;
    }
    return standardToSimple(word) || word;
}

export default async function WordLookupPage({params}: { params: Promise<{ slug: string }> }) {
    const {slug: rawSlug} = await params;
    const slug = decodeSlugParam(rawSlug);
    const normalized = normalizeWord(slug);

    if (!normalized) {
        redirect("/lexicon");
    }

    const db = await init();

    // lexemes has no isv/nsl columns - those live per-flavor in
    // lexeme_allophones (see app/api/lexicon/services.ts's la_core/la_nsl
    // join, the same pattern used here). l.value is kept as a fallback match
    // for the (rare) lexeme with no CORE "standard" allophone row.
    const rows = db.prepare(`
        SELECT l.id, l.value
        FROM lexemes l
        LEFT JOIN lexeme_allophones la_core ON la_core.lexemeId = l.id
            AND la_core.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE') AND la_core.type = 'standard'
        LEFT JOIN lexeme_allophones la_nsl ON la_nsl.lexemeId = l.id
            AND la_nsl.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'NSL') AND la_nsl.type = 'standard'
        WHERE l.value = ? OR la_core.value = ? OR la_nsl.value = ?
        LIMIT 5
    `).all(normalized, normalized, normalized) as { id: number; value: string }[];

    if (rows.length === 0) {
        redirect(`/lexicon?q=${encodeURIComponent(slug)}`);
    }

    if (rows.length === 1) {
        redirect(`/words/${rows[0].id}`);
    }

    redirect(`/lexicon?q=${encodeURIComponent(normalized)}`);
}