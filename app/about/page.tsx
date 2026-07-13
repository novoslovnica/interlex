import { prismaData as db } from "@/lib/prisma"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import { TechnicalAboutClient } from "./about-client"
import type { Metadata } from "next";
import {getTranslations} from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function AboutPage() {
    const [totalWords, totalMeanings, totalRoots] = await Promise.all([
        db.lexeme.count(),
        db.meaning.count(),
        db.morpheme.count(),
    ])

    const technicalData = {
        wordCount: totalWords.toLocaleString(),
        meaningCount: totalMeanings.toLocaleString(),
        rootCount: totalRoots.toLocaleString(),
        languageCount: TRANSLATION_LANGUAGES.length,
        environment: process.env.NODE_ENV || "development",
        nextVersion: "15.0 (App Router)",
        ormVersion: "Prisma 5.x",
    }

    return (
        <div className="h-full flex flex-col py-10 bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0f172a] dark:text-slate-100">
            <TechnicalAboutClient data={technicalData} />
        </div>
    )
}
