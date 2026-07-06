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
import {NextIntlClientProvider} from "next-intl";
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
    default: "Междуславянский лексикон | Interslavic Lexicon",
    template: "%s | Междуславянский лексикон",
  },
  description: "Поиск по словарю междуславянского языка с переводом, морфологией, этимологией и корпусами текстов. Interslavic lexical dictionary with translations, grammar, and etymology.",
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
          <body className="h-screen overflow-hidden flex flex-col">
              <ThemeProvider>
                  <NextIntlClientProvider messages={messages}>
                      <header className="site-header">
                          <div className="header-content">
                              <h1><Link href="/">Междуславянский лексикон</Link></h1>
                              <nav>
                                  <HeaderNav session={session} />
                              </nav>
                          </div>
                      </header>
                      <div className="flex-1 min-h-0">
                          {children}
                      </div>
                      <Footer />
                  </NextIntlClientProvider>
              </ThemeProvider>
          </body>
      </html>
  );
}
