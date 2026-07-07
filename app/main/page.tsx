import { prismaData as db } from "@/lib/prisma"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import MainClient from "./main-client"
import DevStatusToast from "@/components/DevStatusToast";
import type { Metadata } from "next";
import {Word} from "@/prisma/generated/data/client";
import {getRandomWordWithTranslations} from "@/app/main/aggregate";

export const metadata: Metadata = {
  title: "Главная",
  description: "Interslavic Lexicon — межславянский лексикон. Поиск, грамматика, перевод и учебные материалы.",
};

export default async function MainPage() {
    const [totalWords, totalMeanings, totalRoots, randomWord] = await Promise.all([
        db.word.count(),
        db.meaning.count(),
        db.root.count(),
        getRandomWordWithTranslations(),
    ])

    const stats = {
        words: totalWords.toLocaleString(),
        meanings: totalMeanings.toLocaleString(),
        roots: totalRoots.toLocaleString(),
        languages: TRANSLATION_LANGUAGES.length.toString(),
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0f172a] dark:text-slate-100">
            <MainClient
                stats={stats}
                randomWord={randomWord}
            />
            <DevStatusToast />
        </div>
    )
}