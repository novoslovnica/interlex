import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import {ScriptPreference, ThemePreference} from "@/prisma/generated/auth/enums";
import { SettingsClient } from "./settings-client"
import { saveScriptPreference, saveThemePreference, saveLanguagePreference } from "./actions"
import type { Metadata } from "next";
import {ScriptMode} from "@/lib/script-mode";

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
        </div>
    )
}