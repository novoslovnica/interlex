import React, { Suspense } from "react";
import Home from "@/app/lexicon/Home";
import {auth} from "@/auth";
import {getUserScript} from "@/lib/get-user-script";
import type { Metadata } from "next";
import {getTranslations} from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("lexicon");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function HomePage() {
    const session = await auth()

    const currentScript = await getUserScript()
    const t = await getTranslations("lexicon");

  return (
      <>
        <main className="main-content">
          <Suspense fallback={<div className="search-container"><input type="text" className="search-box" placeholder={t("searchPlaceholder")} disabled /></div>}>
            <Home
                currentScript={currentScript}
                isGuest={!session}
            />
          </Suspense>
        </main>
      </>
  );
}
