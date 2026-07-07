import {redirect} from "next/navigation";
import {init} from "@/lib/sqlite";
import {mapNslToEtymologized} from "@/lib/nsl";
import {standardToSimple} from "@/lib/isv";

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
    const {slug} = await params;
    const normalized = normalizeWord(slug);

    if (!normalized) {
        redirect("/lexicon");
    }

    const db = await init();

    const rows = db.prepare(`
        SELECT id, value FROM lexemes WHERE value = ? OR isv = ? OR nsl = ?
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