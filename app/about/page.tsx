import { prismaData as db } from "@/lib/prisma"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import { TechnicalAboutClient } from "./about-client"

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
        <div className="min-h-screen bg-transparent py-10">
            <TechnicalAboutClient data={technicalData} />
        </div>
    )
}
