import {getItem} from "@/app/words/[id]/api";
import {Suspense} from "react";
import Word from "@/app/words/[id]/Word";
import './word-page.css';
import {getUserScript} from "@/lib/get-user-script";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("word");
  const item = await getItem(id) as Record<string, unknown> | null;
  const wordValue = (item?.value ?? item?.isv ?? item?.nsl) as string | undefined;
  const title = wordValue ?? `${t("title")} #${id}`;
  const description = `${t("title")} «${wordValue ?? id}» — ${t("meta.pos")}, ${t("sections.meanings")}, ${t("sections.etymology")}.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} — Interslavic Lexicon`,
      description,
      type: "article",
      url: `/words/${id}`,
    },
    twitter: {
      card: "summary",
      title: `${title} — Interslavic Lexicon`,
      description,
    },
    alternates: {
      canonical: `/words/${id}`,
    },
  };
}

const WordPage = async ({ params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const item = await getItem(id);
    const currentScript = await getUserScript();

    const wordValue = (item?.value ?? item?.isv ?? item?.nsl) as string | undefined;
    const jsonLd = wordValue ? {
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      name: wordValue,
      description: `Word «${wordValue}» in the Interslavic lexicon.`,
      url: `/words/${id}`,
      inDefinedTermSet: "Interslavic Lexicon",
    } : null;

    return (
        <main className="main-content">
            {jsonLd && (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
              />
            )}
            <div className="scroll-container w-full pt-6 px-4">
                <Suspense fallback={<div>Loading...</div>}>
                    <Word item={item} currentScript={currentScript} />
                </Suspense>
            </div>
        </main>
    );
};

export default WordPage;