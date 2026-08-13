import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Feature } from "@/config/features"
import { requirePermission } from "@/lib/permissions"
import DeduplicationClient from "./deduplication-client"
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
    title: "Дедупликация",
    description: "Устранения дубликатов в лексиконе (не омонимов).",
};

export default async function AdminDeduplicationPage() {
    const session = await auth()
    if (!session) redirect("/unauthorized")

    await requirePermission(session, Feature.DeduplicationManage)

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-4 md:px-6 pb-2 shrink-0">
                <h1 className="text-2xl font-bold tracking-tight">Дедупликация базы (Реляционная структура)</h1>
                <p className="text-xs text-muted-foreground">Каскадный перенос смыслов (`Meaning`), синонимов, антонимов и связей корней.</p>
            </div>

            <div className="flex-1 min-h-0 px-4 md:px-6 overflow-hidden">
                <DeduplicationClient />
            </div>
        </div>
    )
}
