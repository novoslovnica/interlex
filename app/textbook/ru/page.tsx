'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function TextbookPage() {
    const t = useTranslations("textbook");
    const [activeChapter, setActiveChapter] = useState('pronunciation');

    const categories = t.raw("categories") as string[];

    const chapters = [
        { id: 'intro', title: t("chapters.preface"), category: categories[0] },
        { id: 'pronunciation', title: t("chapters.ch1"), category: categories[1] },
        { id: 'syntax', title: t("chapters.ch2"), category: categories[1] },
        { id: 'articles', title: t("chapters.ch3"), category: categories[1] },
        { id: 'nouns', title: t("chapters.ch4"), category: categories[1] },
        { id: 'verbs-base', title: t("chapters.ch5"), category: categories[2] },
        { id: 'questions', title: t("chapters.ch6"), category: categories[1] },
        { id: 'pronouns', title: t("chapters.ch7"), category: categories[1] },
        { id: 'adjectives', title: t("chapters.ch8"), category: categories[1] },
        { id: 'numbers', title: t("chapters.ch9"), category: categories[1] },
        { id: 'verbs-present', title: t("chapters.ch10"), category: categories[2] },
        { id: 'adverbs', title: t("chapters.ch11"), category: categories[3] },
        { id: 'imperative', title: t("chapters.ch12"), category: categories[2] },
        { id: 'verbs-past', title: t("chapters.ch13"), category: categories[2] },
        { id: 'verbs-future', title: t("chapters.ch14"), category: categories[2] },
        { id: 'aspects', title: t("chapters.ch15"), category: categories[2] },
        { id: 'participles', title: t("chapters.ch16"), category: categories[2] },
        { id: 'conjunctions', title: t("chapters.ch17"), category: categories[1] },
        { id: 'complex-sentences', title: t("chapters.ch18"), category: categories[1] },
        { id: 'word-formation', title: t("chapters.ch20"), category: categories[3] },
    ];

    return (
        <div className="flex h-full bg-background text-foreground overflow-hidden text-sm">
            <aside className="w-80 border-r bg-muted/20 flex flex-col h-full shrink-0 hidden md:flex">
                <div className="p-4 border-b space-y-3 shrink-0">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {t("backToLexicon")}
                    </Link>
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-base tracking-tight">{t("sidebarTitle")}</h2>
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-xxs font-bold dark:text-blue-400">
                            v1.0
                        </span>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
                    {categories.map((category: string) => (
                        <div key={category} className="space-y-1.5">
                            <h4 className="text-xxs font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">
                                {category}
                            </h4>
                            <div className="space-y-1">
                                {chapters
                                    .filter((ch) => ch.category === category)
                                    .map((chapter) => (
                                        <button
                                            key={chapter.id}
                                            onClick={() => setActiveChapter(chapter.id)}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-all text-xs font-medium block leading-snug ${
                                                activeChapter === chapter.id
                                                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/10'
                                                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {chapter.title}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-background">
                <header className="border-b px-6 py-4 flex items-center justify-between bg-background/50 backdrop-blur shrink-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{t("breadcrumb")}</span>
                        <span>/</span>
                        <span className="text-foreground font-medium">
                            {chapters.find((ch) => ch.id === activeChapter)?.title.split('. ')[1] || t("breadcrumbFallback")}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/lexicon"
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                        >
                            {t("dictionaryLink")}
                        </Link>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-6 md:px-12 2xl:px-24 py-8 md:py-12 no-scrollbar">
                    <article className="max-w-3xl 2xl:max-w-4xl mx-auto space-y-8 pb-16">

                        {activeChapter === 'pronunciation' && (
                            <>
                                <header className="space-y-3 border-b pb-6">
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t("chapterBadge")} 1</span>
                                    <h1 className="text-3xl md:text-4xl 2xl:text-5xl font-black tracking-tight">{t("chapter1.title")}</h1>
                                    <p className="text-base text-muted-foreground">
                                        {t("chapter1.description")}
                                    </p>
                                </header>

                                <section className="space-y-4">
                                    <h3 className="text-lg md:text-xl font-bold">{t("chapter1.subsections.basics")}</h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {t("chapter1.subsections.basicsText")}
                                    </p>

                                    <div className="border rounded-2xl overflow-hidden bg-muted/10 my-6">
                                        <table className="w-full text-left border-collapse text-xs md:text-sm">
                                            <thead>
                                            <tr className="bg-muted/50 border-b">
                                                <th className="p-3 font-semibold">{t("chapter1.tableHeaders.latin")}</th>
                                                <th className="p-3 font-semibold">{t("chapter1.tableHeaders.cyrillic")}</th>
                                                <th className="p-3 font-semibold">{t("chapter1.tableHeaders.ipa")}</th>
                                                <th className="p-3 font-semibold">{t("chapter1.tableHeaders.example")}</th>
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                            <tr>
                                                <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">A a</td>
                                                <td className="p-3 font-bold">А а</td>
                                                <td className="p-3 text-muted-foreground">[a]</td>
                                                <td className="p-3">{t("chapter1.tableExamples.a")}</td>
                                            </tr>
                                            <tr>
                                                <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">Č č</td>
                                                <td className="p-3 font-bold">Ч ч</td>
                                                <td className="p-3 text-muted-foreground">[tʃ]</td>
                                                <td className="p-3">{t("chapter1.tableExamples.c")}</td>
                                            </tr>
                                            <tr>
                                                <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">Ž ž</td>
                                                <td className="p-3 font-bold">Ж ж</td>
                                                <td className="p-3 text-muted-foreground">[ʒ]</td>
                                                <td className="p-3">{t("chapter1.tableExamples.z")}</td>
                                            </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section className="p-5 border border-dashed rounded-2xl bg-blue-500/5 border-blue-500/20 space-y-2">
                                    <h4 className="font-bold text-sm text-blue-600 dark:text-blue-400">{t("chapter1.factBox")}</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {t("chapter1.factText")}
                                    </p>
                                </section>
                            </>
                        )}

                        {activeChapter !== 'pronunciation' && (
                            <>
                                <header className="space-y-3 border-b pb-6">
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t("sectionBadge")}</span>
                                    <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                                        {chapters.find((ch) => ch.id === activeChapter)?.title}
                                    </h1>
                                    <p className="text-base text-muted-foreground">
                                        {t("emptyChapter")}
                                    </p>
                                </header>

                                <section className="py-12 text-center space-y-4 border border-dashed rounded-3xl bg-muted/10">
                                    <div className="text-4xl">📖</div>
                                    <div className="space-y-1 max-w-sm mx-auto">
                                        <h3 className="font-bold text-sm">{t("loading")}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {t("loadingDesc")}
                                        </p>
                                    </div>
                                </section>
                            </>
                        )}

                        <footer className="pt-8 border-t flex items-center justify-between gap-4">
                            <button
                                onClick={() => {
                                    const currentIndex = chapters.findIndex(c => c.id === activeChapter);
                                    if (currentIndex > 0) setActiveChapter(chapters[currentIndex - 1].id);
                                }}
                                disabled={chapters.findIndex(c => c.id === activeChapter) === 0}
                                className="px-4 py-2 border rounded-xl hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent text-xs font-medium transition-colors"
                            >
                                {t("prevChapter")}
                            </button>
                            <button
                                onClick={() => {
                                    const currentIndex = chapters.findIndex(c => c.id === activeChapter);
                                    if (currentIndex < chapters.length - 1) setActiveChapter(chapters[currentIndex + 1].id);
                                }}
                                disabled={chapters.findIndex(c => c.id === activeChapter) === chapters.length - 1}
                                className="px-4 py-2 bg-foreground text-background font-bold rounded-xl hover:bg-foreground/90 disabled:opacity-40 text-xs transition-colors"
                            >
                                {t("nextChapter")}
                            </button>
                        </footer>

                    </article>
                </div>
            </main>

        </div>
    );
}