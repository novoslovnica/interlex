import React from "react";
import Home from "@/app/lexicon/Home";
import {auth} from "@/auth";
import {getUserScript} from "@/lib/get-user-script";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Лексикон",
  description: "Поиск по словарю межславянского языка. Значения, переводы, грамматические формы, этимология и однокоренные слова.",
};

export default async function HomePage() {
    const session = await auth()

    const currentScript = await getUserScript()

  return (
      <>
        <main className="main-content">
          <Home
              currentScript={currentScript}
              isGuest={!session}
          />
        </main>
      </>
  );
}
