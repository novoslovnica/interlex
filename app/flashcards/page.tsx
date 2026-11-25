import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import type { Metadata } from "next"
import { ScriptPreference } from "@/prisma/generated/auth/enums"
import { FlashcardsClient } from "./flashcards-client"
import { ScriptMode } from "@/lib/script-mode"
import { BEGINNER_FLASHCARDS } from "@/lib/beginner-route"
import { VOCABULARY_LEVELS } from "@/lib/vocabulary/assessment"
import { getFlashcardWeek } from "@/lib/srs/dueFlashcards"

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("flashcards")
    return {
        title: t("title"),
        description: t("description"),
    }
}

export default async function FlashcardsPage({ searchParams }: { searchParams: Promise<{ path?: string; level?: string; lang?: string }> }) {
    const params = await searchParams
    const beginner = params.path === "beginner"
    const level = beginner ? VOCABULARY_LEVELS.find(candidate => candidate === params.level) : undefined
    const language = beginner && level && (params.lang === "ru" || params.lang === "en") ? params.lang : undefined
    const callback = new URLSearchParams({ path: "beginner" })
    if (level) callback.set("level", level)
    if (language) callback.set("lang", language)
    const beginnerHref = level ? `/flashcards?${callback}` : BEGINNER_FLASHCARDS
    const session = await auth()
    if (!session?.user?.id) {
        redirect(beginner ? `/login?callbackUrl=${encodeURIComponent(beginnerHref)}` : "/")
    }

    const userId = session.user.id
    const [userSettings, week] = await Promise.all([
        dbAuth.userSettings.findUnique({ where: { userId }, select: { script: true } }),
        getFlashcardWeek(userId),
    ])
    const currentScript = (userSettings?.script || ScriptPreference.CYRILLIC) as ScriptMode

    return <FlashcardsClient
        key={`${beginner}:${level ?? ""}:${language ?? ""}`}
        currentScript={currentScript}
        beginner={beginner}
        initialWeek={week}
        initialLevel={level ?? (beginner ? "A1" : "")}
        language={language}
    />
}
