import { prismaData as db } from "@/lib/prisma"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import MainClient from "./main-client"
import DevStatusToast from "@/components/DevStatusToast";
import type { Metadata } from "next";
import {getRandomWordWithTranslations} from "@/app/main/aggregate";

export const metadata: Metadata = {
  title: "Главная",
  description: "Interslavic Lexicon — межславянский лексикон. Поиск, грамматика, перевод и учебные материалы.",
};

const subStats = [
    { id: 1, label: 'Флаворизаций', value: '5' },
    // { id: 2, label: 'Текстов в корпусе', value: '0' },
]

export default async function MainPage() {
    const [totalWords, totalMeanings, totalRoots, randomWord] = await Promise.all([
        db.lexeme.count(),
        db.meaning.count(),
        db.morpheme.count(),
        getRandomWordWithTranslations(),
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
                subStats={subStats}
                randomWord={randomWord!}
            />
            <DevStatusToast />
        </div>
    )
}