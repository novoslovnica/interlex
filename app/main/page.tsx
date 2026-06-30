import { prismaData as db } from "@/lib/prisma" // Ваша SQLite база данных лексикона
import { TRANSLATION_LANGUAGES } from "@/config/features" // Массив наших 16 языков
import MainClient from "./main-client"
import DevStatusToast from "@/components/DevStatusToast";

export default async function MainPage() {
    // Параллельно собираем живую статистику из базы данных для инфографики
    const [totalWords, totalMeanings, totalRoots] = await Promise.all([
        db.word.count(),
        db.meaning.count(),
        db.root.count(),
    ])

    const stats = {
        words: totalWords.toLocaleString(),
        meanings: totalMeanings.toLocaleString(),
        roots: totalRoots.toLocaleString(),
        languages: TRANSLATION_LANGUAGES.length.toString(),
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0f172a] dark:text-slate-100">
            <MainClient stats={stats} />
            <DevStatusToast />
        </div>
    )
}
