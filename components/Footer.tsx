import Link from "next/link"
import { APP_VERSION } from "@/config/app"
import {getTranslations} from "next-intl/server";

export default async function Footer() {
    const t = await getTranslations("common.footer")
    return (
        <footer className="w-full bg-[#1e293b] text-white flex-shrink-0">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                <nav className="flex flex-col md:flex-row md:items-center gap-2 md:gap-5">
                    <Link href="/proto" className="text-sm text-[#cbd5e1] hover:text-white transition-colors">{t("protoslavic")}</Link>
                    <Link href="/library" className="text-sm text-[#cbd5e1] hover:text-white transition-colors">{t("library")}</Link>
                    <Link href="/textbook/ru" className="text-sm text-[#cbd5e1] hover:text-white transition-colors">{t("textbook")}</Link>
                    <Link href="/about" className="text-sm text-[#cbd5e1] hover:text-white transition-colors">{t("about")}</Link>
                </nav>
                <div className="flex items-center gap-3">
                    <Link
                        href="/changelog"
                        className="text-xs text-[#94a3b8] hover:text-white font-mono transition-colors"
                        title={t("versionHistory")}
                    >
                        v{APP_VERSION}
                    </Link>
                    <span className="text-sm text-[#94a3b8] whitespace-nowrap">© Interslavic Lexicon 2026</span>
                </div>
            </div>
        </footer>
    )
}