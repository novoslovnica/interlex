import {getMainStats} from "./stats"
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

export default async function MainPage() {
    const [counts, randomWord, t] = await Promise.all([
        getMainStats(),
        getRandomWordWithTranslations(),
        getTranslations("main.stats"),
    ])
    const stats = {
        words: counts.words,
        meanings: counts.meanings,
        roots: counts.roots,
        languages: TRANSLATION_LANGUAGES.length,
    }
    const statsLabels = [
        {id: 1, label: t("flavorizations"), value: '5'},
        {id: 2, label: t("corpusTokens"), value: formatCompact(counts.totalTokens)},
        {id: 3, label: t("zipfAlpha"), value: counts.zipfAlpha !== null ? counts.zipfAlpha.toFixed(2) : '—'},
        {id: 4, label: t("lexiconCoverage"), value: counts.coverage.toFixed(2) + '%'},
    ]

    return (
        <div className="h-full flex flex-col bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0f172a] dark:text-slate-100">
            <MainClient
                stats={stats}
                subStats={statsLabels}
                randomWord={randomWord}
            />
            <DevStatusToast />
        </div>
    )
}