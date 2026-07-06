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
        <div className="space-y-4 px-4 md:px-6">
            <AdminNav userRole={session.user.role} />
            <div className="border-b pb-4">
                <h1 className="text-2xl font-bold tracking-tight">Дедупликация базы (Реляционная структура)</h1>
                <p className="text-xs text-muted-foreground">Каскадный перенос смыслов (`Meaning`), синонимов, антонимов и связей корней.</p>
            </div>

            <DeduplicationClient />
        </div>
    )
}
