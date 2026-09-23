import {getItem, getKnownPrepositions} from "@/app/words/[id]/api";
import {Suspense} from "react";
import {notFound} from "next/navigation";
import Word from "@/app/words/[id]/Word";
import './word-page.css';
import {getUserScript} from "@/lib/get-user-script";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import {buildNounParadigm, toParadigmSource} from "@/lib/paradigm";
import {PosType} from "@/lib/grammar/common";
import {fetchWordExamples} from "@/lib/corpus/fetchWordExamples";
import {fetchHistoricalAttestations} from "@/lib/historical/fetchHistoricalAttestations";
import {loadWordHistory} from "@/lib/community/loadWordHistory";
import {loadCommentThread} from "@/lib/community/loadComments";
import {auth} from "@/auth";
import {prismaAuth} from "@/lib/prisma";

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
    // Раньше несуществующий id рендерил пустую страницу с кодом 200 - для
    // поисковика это "мягкий 404" на каждый битый адрес.
    if (!item?.id) notFound();
    const currentScript = await getUserScript();
    const knownPrepositions = item?.pos === PosType.VERB ? await getKnownPrepositions() : [];
    // corpus.db is a separate database from interlex.db (item.slug) - fetched
    // independently and merged here rather than joined in one query.
    const corpusExamples = item?.slug ? await fetchWordExamples(item.slug) : [];
    // historical.db is also a separate database - same fetch-and-merge pattern.
    const historicalAttestations = item?.id ? await fetchHistoricalAttestations(item.id) : [];
    // audit_logs (interlex.db) + ники из auth.db - lib/community/loadWordHistory.ts.
    const history = item?.id ? await loadWordHistory(item.id, { offset: 0 }) : { entries: [], total: 0 };
    // Обсуждение (фаза 5): нить + кто смотрит (для "мой комментарий" и права писать - нужен ник).
    const session = await auth();
    const viewerId = session?.user?.id ?? null;
    const viewerProfile = viewerId ? await prismaAuth.userProfile.findUnique({ where: { userId: viewerId }, select: { handle: true } }) : null;
    const commentViewer = viewerId ? { handle: viewerProfile?.handle ?? null } : null;
    const comments = item?.id ? await loadCommentThread(item.id, viewerId) : { comments: [], total: 0 };

    const wordValue = (item?.value ?? item?.isv ?? item?.nsl) as string | undefined;

    // Та же функция, что у ботов (lib/bots) - одна парадигма на сайт и ботов.
    const nounParadigm = buildNounParadigm(toParadigmSource(item));

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
                    <Word item={item} currentScript={currentScript} nounParadigm={nounParadigm} knownPrepositions={knownPrepositions} corpusExamples={corpusExamples} historicalAttestations={historicalAttestations} history={history} comments={comments} commentViewer={commentViewer} />
                </Suspense>
            </div>
        </main>
    );
};

export default WordPage;