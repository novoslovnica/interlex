import React from "react";
import Home from "@/app/proto/Home";
import {auth} from "@/auth";
import {getUserScript} from "@/lib/get-user-script";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Праславянский словарь",
  description: "Поиск по праславянскому словарю (ESSJa — Этимологический словарь славянских языков под редакцией О. Н. Трубачёва). Леммы, реконструкции и исторические контексты.",
};

export default async function ProtoPage() {
    const session = await auth();
    const currentScript = await getUserScript();

    return (
        <main className="main-content">
            <Home currentScript={currentScript} isGuest={!session} />
        </main>
    );
}