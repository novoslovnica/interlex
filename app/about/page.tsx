import { prismaData as db } from "@/lib/prisma"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import { TechnicalAboutClient } from "./about-client"
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "О проекте",
  description: "Техническая информация о проекте Interslavic Lexicon — количество слов, значений, корней, поддерживаемые языки перевода и сведения об окружении.",
};

export default async function AboutPage() {
    // Вычисляем размер базы данных или каунтеры ключевых индексов
    const [totalWords, totalMeanings, totalRoots] = await Promise.all([
        db.word.count(),
        db.meaning.count(),
        db.root.count(),
    ])

    const technicalData = {
        wordCount: totalWords.toLocaleString(),
        meaningCount: totalMeanings.toLocaleString(),
        rootCount: totalRoots.toLocaleString(),
        languageCount: TRANSLATION_LANGUAGES.length,
        environment: process.env.NODE_ENV || "development",
        nextVersion: "15.0 (App Router)", // Замените на вашу актуальную версию
        ormVersion: "Prisma 5.x",
    }

    return (
        <div className="h-full flex flex-col py-10 bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0f172a] dark:text-slate-100">
            <TechnicalAboutClient data={technicalData} />
        </div>
    )
}
