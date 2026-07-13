import React, { Suspense } from "react";
import Home from "@/app/proto/Home";
import {auth} from "@/auth";
import {getUserScript} from "@/lib/get-user-script";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("proto");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function ProtoPage() {
    const session = await auth();
    const currentScript = await getUserScript();
    const t = await getTranslations("proto");

    return (
        <main className="main-content">
            <Suspense fallback={<div className="search-container"><input type="text" className="search-box" placeholder={t("searchPlaceholder")} disabled /></div>}>
                <Home currentScript={currentScript} isGuest={!session} />
            </Suspense>
        </main>
    );
}