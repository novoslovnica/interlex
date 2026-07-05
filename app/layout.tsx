// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import React from "react";
import { auth } from "@/auth"; // Импортируем серверную авторизацию
import HeaderNav from "@/components/HeaderNav";
import {notFound} from "next/navigation"; // Импортируем новый клиентский компонент
import {NextIntlClientProvider, useTranslations} from "next-intl";
import {getLocale, getMessages} from "next-intl/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Межславянский лексикон | Interslavic Lexicon",
    template: "%s | Межславянский лексикон",
  },
  description: "Поиск по словарю межславянского языка с переводом, морфологией, этимологией и корпусами текстов. Interslavic lexical dictionary with translations, grammar, and etymology.",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
  // Получаем сессию на сервере без задержек для интерфейса
  const session = await auth();

    const locale = await getLocale();
    const messages = await getMessages();

    return (
      <html
          lang={locale}
          className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
          <NextIntlClientProvider messages={messages}>
              <body className="min-h-full flex flex-col">
                  <header className="site-header">
                      <div className="header-content">
                          <h1><Link href="/">Межславянский лексикон</Link></h1>
                          <nav>
                              {/* Передаем полученную сессию в изолированный список навигации */}
                              <HeaderNav session={session} />
                          </nav>
                      </div>
                  </header>
                  {children}
              </body>
          </NextIntlClientProvider>
      </html>
  );
}
