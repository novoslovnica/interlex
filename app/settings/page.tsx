import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import {ScriptPreference} from "@/prisma/generated/auth/enums";
import { SettingsClient } from "./settings-client"
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Настройки",
  description: "Настройки аккаунта и персонализация отображения межславянского лексикона — выбор кириллицы или латиницы.",
};

export default async function UserSettingsPage() {
    const session = await auth()

    if (!session || !session.user) {
        redirect("/")
    }

    const userSettings = await dbAuth.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { script: true }
    })

    // Приводим enum к строке для передачи на клиент
    const currentScript = (userSettings?.script || ScriptPreference.CYRILLIC) as "CYRILLIC" | "LATIN"

    // Server Action принимает чистую строку с клиента
    async function saveScriptPreference(preference: "CYRILLIC" | "LATIN") {
        "use server"
        const serverSession = await auth()
        if (!serverSession || !serverSession.user) throw new Error("Unauthorized")

        await dbAuth.userSettings.upsert({
            where: { userId: serverSession.user.id },
            create: {
                userId: serverSession.user.id,
                script: preference as ScriptPreference // Приводим строку к типу Prisma перед записью в БД
            },
            update: {
                script: preference as ScriptPreference
            }
        })
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 px-4 md:px-6 py-10">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Настройки аккаунта</h1>
                <p className="text-muted-foreground text-sm">
                    Персонализация отображения Межславянского лексикона под ваши предпочтения.
                </p>
            </div>

            <SettingsClient
                initialScript={currentScript}
                onSaveScript={saveScriptPreference}
            />
        </div>
    )
}
