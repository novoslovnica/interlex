import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import {ScriptPreference, ThemePreference} from "@/prisma/generated/auth/enums";
import { SettingsClient } from "./settings-client"
import { saveScriptPreference, saveThemePreference, saveLanguagePreference } from "./actions"
import type { Metadata } from "next";
import {ScriptMode} from "@/lib/script-mode";
import { getTranslations } from "next-intl/server"

export const metadata: Metadata = {
  title: "Настройки",
  description: "Настройки аккаунта и персонализация отображения межславянского лексикона — выбор кириллицы или латиницы, темы сайта, языка по умолчанию.",
};

export default async function UserSettingsPage() {
    const session = await auth()
    if (!session?.user?.id) {
        redirect("/")
    }

    const userSettings = await dbAuth.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { script: true, theme: true, language: true }
    })

    const currentScript = (userSettings?.script || ScriptPreference.CYRILLIC) as ScriptMode
    const currentTheme = (userSettings?.theme || ThemePreference.SYSTEM) as "LIGHT" | "DARK" | "SYSTEM"
    const currentLanguage = userSettings?.language || "isv"
    const t = await getTranslations("apiKeys")

    return (
        <div className="h-full overflow-y-auto max-w-4xl mx-auto space-y-6 px-4 md:px-6 py-10 no-scrollbar">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Настройки аккаунта</h1>
                <p className="text-muted-foreground text-sm">
                    Персонализация отображения Межславянского лексикона под ваши предпочтения.
                </p>
            </div>
            <SettingsClient
                initialScript={currentScript}
                initialTheme={currentTheme}
                initialLanguage={currentLanguage}
                onSaveScript={saveScriptPreference}
                onSaveTheme={saveThemePreference}
                onSaveLanguage={saveLanguagePreference}
            />
            <Link
                href="/settings/api-keys"
                className="block border rounded-xl bg-background p-6 shadow-sm border-border/60 hover:bg-muted/40 transition-colors max-w-2xl"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("linkCard.title")}</h2>
                        <p className="text-xs text-muted-foreground mt-1">{t("linkCard.description")}</p>
                    </div>
                    <span className="text-sm text-blue-600 font-medium whitespace-nowrap ml-4">{t("linkCard.cta")} →</span>
                </div>
            </Link>
        </div>
    )
}