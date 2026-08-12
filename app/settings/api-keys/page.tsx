import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import type { Metadata } from "next"
import { ApiKeysClient } from "./api-keys-client"

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("apiKeys")
    return {
        title: t("title"),
        description: t("description"),
    }
}

export default async function ApiKeysPage() {
    const session = await auth()
    if (!session?.user?.id) {
        redirect("/")
    }

    return (
        <div className="h-full overflow-y-auto mx-auto px-4 md:px-6 py-10 no-scrollbar">
            <ApiKeysClient />
        </div>
    )
}
