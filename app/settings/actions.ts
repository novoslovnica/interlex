"use server"

import { auth } from "@/auth"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { ScriptPreference, ThemePreference } from "@/prisma/generated/auth/enums"
import { TRANSLATION_LANGUAGE_CODES } from "@/lib/translations"
import { validateHandle, BIO_MAX_LENGTH, type HandleError } from "@/lib/community/handle"

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

export async function saveColumnVisibilityPreference(columnVisibilityJson: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")

    await dbAuth.userSettings.upsert({
        where: { userId: session.user.id },
        create: {
            userId: session.user.id,
            columnVisibility: columnVisibilityJson
        },
        update: {
            columnVisibility: columnVisibilityJson
        }
    })
}

const USER_LANGUAGE_LEVELS = new Set(["native", "fluent"])
const MAX_USER_LANGUAGES = 8

export interface UserLanguageInput {
    language: string
    level: string
}

// Полная замена набора: форма в настройках отправляет список целиком, так
// проще, чем отдельные add/remove, и нет промежуточных состояний.
export async function saveUserLanguages(languages: UserLanguageInput[]) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")
    const userId = session.user.id

    const allowedCodes = new Set<string>(TRANSLATION_LANGUAGE_CODES)
    const byCode = new Map<string, string>()
    for (const entry of languages) {
        if (!allowedCodes.has(entry.language) || !USER_LANGUAGE_LEVELS.has(entry.level)) {
            throw new Error("Invalid language")
        }
        byCode.set(entry.language, entry.level)
    }
    if (byCode.size > MAX_USER_LANGUAGES) throw new Error("Too many languages")

    await dbAuth.$transaction([
        dbAuth.userLanguage.deleteMany({ where: { userId, language: { notIn: [...byCode.keys()] } } }),
        ...[...byCode].map(([language, level]) =>
            dbAuth.userLanguage.upsert({
                where: { userId_language: { userId, language } },
                create: { userId, language, level },
                update: { level },
            })
        ),
    ])
}

export type SaveProfileResult = { ok: true; handle: string } | { ok: false; error: HandleError | "taken" | "bio_too_long" }

// Возвращает результат, а не бросает: в production Next вырезает текст
// ошибки server action, и клиент не отличил бы "ник занят" от сбоя.
export async function savePublicProfile(rawHandle: string, rawBio: string): Promise<SaveProfileResult> {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")
    const userId = session.user.id

    const validation = validateHandle(rawHandle)
    if (!validation.ok) return validation
    const bio = rawBio.trim()
    if (bio.length > BIO_MAX_LENGTH) return { ok: false, error: "bio_too_long" }

    const owner = await dbAuth.userProfile.findUnique({ where: { handle: validation.handle }, select: { userId: true } })
    if (owner && owner.userId !== userId) return { ok: false, error: "taken" }

    try {
        await dbAuth.userProfile.upsert({
            where: { userId },
            create: { userId, handle: validation.handle, bio: bio || null },
            update: { handle: validation.handle, bio: bio || null },
        })
    } catch {
        // Гонка двух одновременных сохранений одного ника - ловит уникальный индекс.
        return { ok: false, error: "taken" }
    }
    return { ok: true, handle: validation.handle }
}

// Отказ от публичности: строка удаляется, вклад остаётся, но подписывается "Аноним".
export async function deletePublicProfile() {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")
    await dbAuth.userProfile.deleteMany({ where: { userId: session.user.id } })
}
