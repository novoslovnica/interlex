import {init} from "@/lib/sqlite";
import {redirect, notFound} from "next/navigation";
import {decodeSlugParam} from "@/lib/slug";

const getProtoByLemma = async (lemma: string) => {
    const db = await init();
    const data = db.prepare('SELECT id FROM proto_slavic_words WHERE lemma = ?').get(lemma) as { id: number } | undefined;
    console.log(data, lemma);
    return data ?? null;
};

const ProtoWordRedirectPage = async ({params}: { params: Promise<{ slug: string }> }) => {
    const {slug} = await params;
    const decoded = decodeSlugParam(slug);
    const item = await getProtoByLemma(decoded);

    if (!item) {
        notFound();
    }

    redirect(`/proto/${item.id}`);
};

export default ProtoWordRedirectPage;