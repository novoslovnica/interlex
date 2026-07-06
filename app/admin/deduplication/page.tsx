import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { Feature } from "@/config/features"
import DeduplicationClient from "./deduplication-client"
import AdminNav from "@/components/AdminNav";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
    title: "Дедупликация",
    description: "Устранения дубликатов в лексиконе (не омонимов).",
};

export default async function AdminDeduplicationPage() {
    const session = await auth()
    if (!session) redirect("/unauthorized")

    if (session.user.role !== "ADMIN") {
        if (session.user.role !== "MODERATOR") redirect("/unauthorized")
        const hasFeature = await dbAuth.featurePermission.findFirst({
            where: { userId: session.user.id, featureKey: Feature.DictionaryEdit }
        })
        if (!hasFeature) redirect("/unauthorized")
    }

    return (
        <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
            <div className="flex flex-col h-full overflow-hidden">
                <AdminNav userRole={session.user.role} />
                <div className="px-4 md:px-6 pb-2 shrink-0">
                    <h1 className="text-2xl font-bold tracking-tight">Дедупликация базы (Реляционная структура)</h1>
                    <p className="text-xs text-muted-foreground">Каскадный перенос смыслов (`Meaning`), синонимов, антонимов и связей корней.</p>
                </div>

                <div className="flex-1 min-h-0 px-4 md:px-6 overflow-hidden">
                    <DeduplicationClient />
                </div>
            </div>
        </div>
    )
}
