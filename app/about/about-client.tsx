"use client"

import { useTranslations } from "next-intl"

interface TechnicalAboutProps {
    data: {
        wordCount: string
        meaningCount: string
        rootCount: string
        languageCount: number
        environment: string
        nextVersion: string
        ormVersion: string
    }
}

export function TechnicalAboutClient({ data }: TechnicalAboutProps) {
    const t = useTranslations("about")

    const versions = [
        { version: "v 1.0", year: "2015", title: t("versions.v1"), description: t("versions.v1desc") },
        { version: "v 2.0+", year: "2016", title: t("versions.v2"), description: t("versions.v2desc") },
        { version: "v 3.0", year: "2019", title: "Common Web Interslavic Dictionary", description: t("versions.v3desc") },
        { version: "v 4.0", year: "2026", title: "Interslavic Lexicon", description: t("versions.v4desc") },
    ]

    const orthographyRules = t.raw("orthographyRules") as string[]

    return (
        <div className="h-full overflow-y-auto max-w-4xl mx-auto px-4 md:px-6 pb-12 space-y-12 animate-fade-in text-sm no-scrollbar">

            <div className="space-y-3">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {t("heading")}
                </h1>
                <p className="text-muted-foreground leading-relaxed">
                    {t("intro")}
                </p>
            </div>

            <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-1">
                    {t("sections.metrics")}
                </h2>
                <div className="border rounded-xl bg-background overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <tbody className="divide-y text-xs">
                        <tr className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-semibold text-muted-foreground w-1/2">{t("metrics.words")}</td>
                            <td className="p-3 font-mono text-foreground">{data.wordCount}</td>
                        </tr>
                        <tr className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-semibold text-muted-foreground">{t("metrics.roots")}</td>
                            <td className="p-3 font-mono text-foreground">{data.rootCount}</td>
                        </tr>
                        <tr className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-semibold text-muted-foreground">{t("metrics.meanings")}</td>
                            <td className="p-3 font-mono text-foreground">{data.meaningCount}</td>
                        </tr>
                        <tr className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-semibold text-muted-foreground">{t("metrics.languages")}</td>
                            <td className="p-3 font-mono text-foreground">{data.languageCount} {t("metrics.isolatedTables")}</td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-1">
                    {t("sections.orthography")}
                </h2>
                <div className="p-4 border rounded-xl bg-background space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {t("orthographyText")}
                    </p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                        {orthographyRules.map((rule: string, i: number) => (
                            <li key={i}>{rule}</li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-1">
                    {t("sections.projects")}
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("projectsIntro")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="p-4 border rounded-xl bg-background space-y-1">
                        <span className="font-bold text-xs block text-foreground">Interslavic Language Portal</span>
                        <span className="text-xs text-muted-foreground block leading-normal">
                            {t("projects.portal")}
                        </span>
                        <a
                            href="http://interslavic-language.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block pt-1 font-medium"
                        >
                            interslavic-language.org →
                        </a>
                    </div>

                    <div className="p-4 border rounded-xl bg-background space-y-1">
                        <span className="font-bold text-xs block text-foreground">Interslavic Dictionary Service</span>
                        <span className="text-xs text-muted-foreground block leading-normal">
                            {t("projects.dictionary")}
                        </span>
                        <a
                            href="https://interslavic-dictionary.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block pt-1 font-medium"
                        >
                            interslavic-dictionary.com →
                        </a>
                    </div>

                    <div className="p-4 border rounded-xl bg-background space-y-1 hover:border-blue-500/30 transition-colors">
                        <span className="font-bold text-xs block text-foreground">Interslavic Community (Facebook)</span>
                        <span className="text-xs text-muted-foreground block leading-normal">
                            {t("projects.community")}
                        </span>
                        <a
                            href="https://www.facebook.com/groups/interslavic/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block pt-1 font-medium"
                        >
                            facebook.com/groups/interslavic →
                        </a>
                    </div>

                    <div className="p-4 border rounded-xl bg-background space-y-1 hover:border-blue-500/30 transition-colors">
                        <span className="font-bold text-xs block text-foreground">Interslavic Wiki</span>
                        <span className="text-xs text-muted-foreground block leading-normal">
                            {t("projects.wiki")}
                        </span>
                        <a
                            href="https://wikipedia.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block pt-1 font-medium"
                        >
                            isv.wikipedia.org →
                        </a>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-1">
                    {t("sections.contacts")}
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("contactsDescription")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="p-4 border rounded-xl bg-background space-y-1">
                        <span className="font-bold text-xs block text-foreground">{t("contacts.email")}</span>
                        <span className="text-xs text-muted-foreground block">
                            {t("contacts.emailDesc")}
                        </span>
                        <a
                            href="mailto:support@interslavic-lexicon.com"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block pt-1 font-mono"
                        >
                            support@interslavic-lexicon.com
                        </a>
                    </div>

                    <div className="p-4 border rounded-xl bg-background space-y-1">
                        <span className="font-bold text-xs block text-foreground">{t("contacts.community")}</span>
                        <span className="text-xs text-muted-foreground block">
                            {t("contacts.communityDesc")}
                        </span>
                        <a
                            href="https://t.me"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block pt-1 font-medium"
                        >
                            t.me/interslavic
                        </a>
                    </div>
                </div>
            </div>

            <div className="border border-dashed rounded-xl p-4 bg-muted/10 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                    <h3 className="font-bold text-xs text-foreground">{t("openSource")}</h3>
                    <p className="text-xs text-muted-foreground">
                        {t("openSourceDesc")}
                    </p>
                </div>
                <a
                    href="https://github.com/nowoslownica/interlex"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-background border rounded-md text-xs font-semibold hover:bg-muted transition-colors shrink-0 shadow-sm"
                >
                    {t("githubLink")}
                </a>
            </div>

            <section className="mt-12">
                <h2 className="text-sm font-bold uppercase tracking-wider text-black border-b border-black pb-2 mb-4">
                    {t("sections.history")}
                </h2>

                <p className="text-xs text-neutral-600 mb-6 leading-relaxed">
                    {t("historyIntro")}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {versions.map((item, index) => (
                        <div
                            key={index}
                            className="border border-neutral-300 rounded-lg p-5 bg-white flex flex-col justify-between hover:border-neutral-400 transition-colors"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                                    {item.version}
                                  </span>
                                  <span className="text-xs font-medium text-neutral-400">
                                    {item.year}
                                  </span>
                                </div>
                                <h3 className="text-sm font-bold text-black mb-1">
                                    {item.title}
                                </h3>
                                <p className="text-xs text-neutral-500 leading-relaxed">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}