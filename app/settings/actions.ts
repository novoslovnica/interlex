"use server"

import { auth } from "@/auth"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { ScriptPreference, ThemePreference } from "@/prisma/generated/auth/enums"

export async function saveScriptPreference(preference: "CYRILLIC" | "LATIN") {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await dbAuth.userSettings.upsert({
        where: { userId: session.user.id },
        create: {
            userId: session.user.id,
            script: preference as ScriptPreference
        },
        update: {
            script: preference as ScriptPreference
        }
    })
}

export async function saveThemePreference(preference: "LIGHT" | "DARK" | "SYSTEM") {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await dbAuth.userSettings.upsert({
        where: { userId: session.user.id },
        create: {
            userId: session.user.id,
            theme: preference as ThemePreference
        },
        update: {
            theme: preference as ThemePreference
        }
    })
}

export async function saveLanguagePreference(language: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await dbAuth.userSettings.upsert({
        where: { userId: session.user.id },
        create: {
            userId: session.user.id,
            language: language
        },
        update: {
            language: language
        }
    })
}