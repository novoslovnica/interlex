import { auth } from "@/auth"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { headers } from "next/headers"

export type ScriptMode = "CYRILLIC" | "LATIN"

export async function getUserScript(): Promise<ScriptMode> {
    const session = await auth()

    // Сценарий 1: Пользователь вошел в систему -> берем из его настроек в БД
    if (session?.user?.id) {
        const userSettings = await dbAuth.userSettings.findUnique({
            where: { userId: session.user.id },
            select: { script: true },
        })
        if (userSettings?.script) {
            return userSettings.script as ScriptMode
        }
    }

    // Сценарий 2: Пользователь — гость -> анализируем локаль браузера через заголовки
    const headerList = await headers()
    const acceptLanguage = headerList.get("accept-language") || ""

    // Массив языковых кодов, которые по умолчанию ассоциируются с латиницей
    // pl (польский), cs (чешский), sk (словацкий), hr (хорватский), sl (словенский) и т.д.
    const latinLocales = ["pl", "cs", "sk", "hr", "sl", "en", "de", "fr", "es", "it"]

    // Проверяем, начинается ли список локалей браузера с латинских стран
    const primaryLocale = acceptLanguage.split(",")[0].split("-")[0].toLowerCase()

    if (latinLocales.includes(primaryLocale)) {
        return "LATIN"
    }

    // По умолчанию для всех остальных (ru, bg, mk, uk, be, sr) отдаем кириллицу
    return "CYRILLIC"
}
