import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import type { Metadata } from "next"
import { ScriptPreference } from "@/prisma/generated/auth/enums"
import { FlashcardsClient } from "./flashcards-client"
import { ScriptMode } from "@/lib/script-mode"

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("flashcards")
    return {
        title: t("title"),
        description: t("description"),
    }
}

export default async function FlashcardsPage() {
    const session = await auth()
    if (!session?.user?.id) {
        redirect("/")
    }

    const userSettings = await dbAuth.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { script: true },
    })
    const currentScript = (userSettings?.script || ScriptPreference.CYRILLIC) as ScriptMode

    return <FlashcardsClient currentScript={currentScript} />
}
