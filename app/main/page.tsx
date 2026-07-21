import { prismaData as db, prismaCorpus } from "@/lib/prisma"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import MainClient from "./main-client"
import DevStatusToast from "@/components/DevStatusToast";
import type { Metadata } from "next";
import {getRandomWordWithTranslations} from "@/app/main/aggregate";
import {getTranslations} from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("main");
  return {
    title: t("title"),
    description: t("description"),
  };
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K';
  return String(n);
}

function computeZipfAlpha(points: { rank: number; freq: number }[]): number | null {
  if (points.length < 2) return null;
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of points) {
    const x = Math.log(p.rank);
    const y = Math.log(p.freq);
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
  }
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  return -slope;
}

async function getCorpusStats() {
  const [totalTokens, matchedTokens, sentences] = await Promise.all([
    prismaCorpus.corpusToken.count(),
    prismaCorpus.corpusToken.count({ where: { wordSlug: { not: null } } }),
    prismaCorpus.corpusSentence.count(),
  ]);

  const coverage = totalTokens > 0 ? (matchedTokens / totalTokens) * 100 : 0;

  const rows = await prismaCorpus.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM "CorpusToken" GROUP BY lemma`
  );
  const uniqueLemmas = rows.length;

  const freqRows = await prismaCorpus.$queryRawUnsafe<
    { lemma: string; count: bigint }[]
  >(`SELECT lemma, COUNT(*) as count FROM "CorpusToken" GROUP BY lemma`);

  const sorted = freqRows
    .map(r => Number(r.count))
    .sort((a, b) => b - a);

  const regressionPoints: { rank: number; freq: number }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= 2) {
      regressionPoints.push({ rank: i + 1, freq: sorted[i] });
    }
  }

  const zipfAlpha = computeZipfAlpha(regressionPoints);

  return { totalTokens, coverage, sentences, uniqueLemmas, zipfAlpha };
}

const subStats = async () => {
    const t = await getTranslations("main.stats");
    const corpus = await getCorpusStats();
    return [
        { id: 1, label: t("flavorizations"), value: '5' },
        { id: 2, label: t("corpusTokens"), value: formatCompact(corpus.totalTokens) },
        { id: 3, label: t("zipfAlpha"), value: corpus.zipfAlpha !== null ? corpus.zipfAlpha.toFixed(2) : '—' },
        { id: 4, label: t("lexiconCoverage"), value: corpus.coverage.toFixed(2) + '%' },
    ];
}

export default async function MainPage() {
    const [totalWords, totalMeanings, totalRoots, randomWord, statsLabels] = await Promise.all([
        db.lexeme.count(),
        db.meaning.count(),
        db.morpheme.count(),
        getRandomWordWithTranslations(),
        subStats(),
    ])

    const stats = {
        words: totalWords,
        meanings: totalMeanings,
        roots: totalRoots,
        languages: TRANSLATION_LANGUAGES.length,
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0f172a] dark:text-slate-100">
            <MainClient
                stats={stats}
                subStats={statsLabels}
                randomWord={randomWord!}
            />
            <DevStatusToast />
        </div>
    )
}