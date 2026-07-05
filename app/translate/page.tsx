import React from "react";
import Home from "@/app/translate/Home";
import {auth} from "@/auth";
import {getUserScript} from "@/lib/get-user-script";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Перевод",
  description: "Перевод с межславянского языка на 16 славянских и неславянских языков с активными ссылками на толковые словари.",
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
