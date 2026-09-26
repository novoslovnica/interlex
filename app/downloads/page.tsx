import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { HUNSPELL_FILES, hunspellFileSize, readHunspellMetadata } from "@/lib/export/hunspell/files"

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("downloads")
    return { title: t("title"), description: t("description") }
}

// Файлы собирает scripts/export-hunspell.ts; страница только читает metadata.json.
export const dynamic = "force-dynamic"

function formatSize(bytes: number | null): string {
    if (bytes === null) return "—"
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

const linkClass = "inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"

export default async function DownloadsPage() {
    const t = await getTranslations("downloads")
    const meta = readHunspellMetadata()
    const file = (name: keyof typeof HUNSPELL_FILES & string) => ({ name, href: `/api/downloads/${name}`, size: formatSize(hunspellFileSize(name)) })

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight mb-2">{t("title")}</h1>
                <p className="text-muted-foreground">{t("description")}</p>
            </header>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">{t("spellcheck.heading")}</h2>
                <p className="text-sm">{t("spellcheck.about")}</p>
                {meta ? (
                    <>
                        <p className="text-sm text-muted-foreground">
                            {t("spellcheck.version", {
                                version: meta.version,
                                date: meta.builtAt.slice(0, 10),
                                latin: (meta.stats.isv_Latn?.words ?? 0).toLocaleString(),
                                cyrillic: (meta.stats.isv_Cyrl?.words ?? 0).toLocaleString(),
                            })}
                        </p>
                        <div className="flex flex-wrap gap-3">
                            {[file("isv-spellcheck.oxt"), file("isv-hunspell.zip")].map((f) => (
                                <a key={f.name} href={f.href} className={linkClass} download>
                                    {f.name} <span className="text-muted-foreground">{f.size}</span>
                                </a>
                            ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {t.rich("spellcheck.license", {
                                link: (chunks) => (
                                    <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                                        {chunks}
                                    </a>
                                ),
                            })}
                        </p>
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">{t("spellcheck.notBuilt")}</p>
                )}
            </section>

            <section className="space-y-3 text-sm">
                <h2 className="text-xl font-semibold">{t("install.heading")}</h2>
                <div>
                    <h3 className="font-semibold">LibreOffice</h3>
                    <p>{t("install.libreoffice")}</p>
                </div>
                <div>
                    <h3 className="font-semibold">Firefox, Thunderbird</h3>
                    <p>{t("install.firefox")}</p>
                </div>
                <div>
                    <h3 className="font-semibold">{t("install.editorsHeading")}</h3>
                    <p>{t("install.editors")}</p>
                </div>
                <p className="text-muted-foreground">{t("install.spelling")}</p>
            </section>
        </div>
    )
}
