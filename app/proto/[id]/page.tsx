import {getProtoItem} from "@/app/proto/[id]/api";
import {Suspense} from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import './proto-word.css';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("proto");
  const item = await getProtoItem(id) as { lemma: string } | null;
  return {
    title: `*${item?.lemma ?? id}`,
    description: `${t("source")} *${item?.lemma ?? id} — ${t("title")}.`,
  };
}

const ProtoWordPage = async ({params}: { params: Promise<{ id: string }> }) => {
    const {id} = await params;
    const t = await getTranslations("proto");
    const item = await getProtoItem(id) as { id: number; lemma: string; body: string; source_url: string } | null;

    if (!item) {
        return (
            <main className="main-content">
                <div className="scroll-container w-full pt-6 px-4">
                    <div className="text-center py-20 text-slate-400">
                        <p className="text-lg">{t("notFound")}</p>
                        <Link href="/proto" className="text-blue-600 hover:underline mt-4 inline-block">
                            {t("backLink")}
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    const displayLemma = `*${item.lemma}`;

    return (
        <main className="main-content">
            <div className="scroll-container w-full pt-6 px-4">
                <Suspense fallback={<div>Loading...</div>}>
                    <article className="max-w-3xl mx-auto mb-8 bg-white p-6 md:p-8 rounded-2xl shadow-md border border-slate-100">
                        <Link href="/proto" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
                            {t("backLink")}
                        </Link>

                        <header className="border-b border-slate-200 pb-4 mb-5">
                            <h1 className="text-4xl font-bold text-slate-800 tracking-tight font-serif">
                                {displayLemma}
                            </h1>
                        </header>

                        <div className="prose prose-slate max-w-none text-base leading-relaxed text-slate-700">
                            {item.body.split('\n').map((paragraph, idx) => (
                                <p key={idx} className="mb-3">{paragraph}</p>
                            ))}
                        </div>

                        {item.source_url && (
                            <div className="mt-8 pt-4 border-t border-slate-100">
                                <a
                                    href={item.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm"
                                >
                                    {t("source")} {item.source_url} <span>→</span>
                                </a>
                            </div>
                        )}
                    </article>
                </Suspense>
            </div>
        </main>
    );
};

export default ProtoWordPage;