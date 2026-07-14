import {getItem} from "@/app/words/[id]/api";
import {Suspense} from "react";
import Word from "@/app/words/[id]/Word";
import './word-page.css';
import {getUserScript} from "@/lib/get-user-script";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import {declineWordAutomatically} from "@/lib/grammar/declineNoun";
import {resolveGender} from "@/lib/grammar/stemClassifier";
import {PosType} from "@/lib/grammar/common";

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

    let nounParadigm: { singular: Record<string, string>; dual: Record<string, string>; plural: Record<string, string> } | null = null;
    if (item?.pos === PosType.NOUN) {
      const CASES_LIST = ['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'locative', 'vocative'] as const;
      const NUMBERS_LIST = ['singular', 'dual', 'plural'] as const;

      nounParadigm = { singular: {}, dual: {}, plural: {} };

      for (const num of NUMBERS_LIST) {
        for (const c of CASES_LIST) {
          try {
            nounParadigm[num][c] = declineWordAutomatically({
              dbItem: {
                interslavic: item.stem || item.word?.value || item.value,
                protoSlavic: item.proto || "",
                gender: resolveGender(item.gender, item.protoStemClass),
                animacy: item.animacy || undefined,
                protoStemClass: item.protoStemClass || "u",
                paradigm: item.paradigm || "A",
                stressPosition: item.stressPosition,
                morphemes: item.roots?.map((r: any) => ({
                  value: r.value,
                  stressPosition: r.stressPosition,
                })),
              },
              targetCase: c,
              targetNumber: num,
            });
          } catch {
            nounParadigm[num][c] = '—';
          }
        }
      }
    }

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
                    <Word item={item} currentScript={currentScript} nounParadigm={nounParadigm} />
                </Suspense>
            </div>
        </main>
    );
};

export default WordPage;