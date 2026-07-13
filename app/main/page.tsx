import { prismaData as db } from "@/lib/prisma"
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

const subStats = async () => {
    const t = await getTranslations("main.stats");
    return [
        { id: 1, label: t("flavorizations"), value: '5' },
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