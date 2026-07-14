// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import React from "react";
import { auth } from "@/auth";
import HeaderNav from "@/components/HeaderNav";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import {NextIntlClientProvider} from "next-intl";
import {getLocale, getMessages} from "next-intl/server";
import Title from "@/components/Title";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL)
    : new URL('http://localhost:3000'),
  title: {
    default: "Межславянский лексикон | Interslavic Lexicon",
    template: "%s | Межславянский лексикон",
  },
  description: "Поиск по словарю междуславянского языка с переводом, морфологией, этимологией и корпусами текстов. Interslavic lexical dictionary with translations, grammar, and etymology.",
  openGraph: {
    type: "website",
    siteName: "Interslavic Lexicon",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary",
  },
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
  const session = await auth();

    const locale = await getLocale();
    const messages = await getMessages();

    return (
      <html
          lang={locale}
          className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
          suppressHydrationWarning
      >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Monomakh&family=Noto+Sans+Glagolitic&display=swap" rel="stylesheet" />
      </head>
          <body className="h-screen overflow-hidden flex flex-col">
              <ThemeProvider>
                  <SessionProviderWrapper>
                  <NextIntlClientProvider messages={messages}>
                      <header className="site-header">
                          <div className="header-content">
                              <Title />
                              <nav>
                                  <HeaderNav session={session} />
                              </nav>
                          </div>
                      </header>
                      <div className="flex flex-col flex-1 min-h-0">
                          {children}
                      </div>
                      <Footer />
                  </NextIntlClientProvider>
                  </SessionProviderWrapper>
              </ThemeProvider>
          </body>
      </html>
  );
}
