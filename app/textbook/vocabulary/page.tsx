import Link from "next/link"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { BEGINNER_ROUTE, BEGINNER_VOCABULARY } from "@/lib/beginner-route"
import { getUserScript } from "@/lib/get-user-script"
import { writeOrTranslate } from "@/lib/script-mode"
import { loadVocabularyQuestions } from "@/lib/vocabulary/questionBank"
import { VocabularyQuiz } from "./quiz"

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("vocabulary")
    return { title: t("title"), description: t("description") }
}

export default async function VocabularyPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
    const [t, locale, script, params] = await Promise.all([
        getTranslations("vocabulary"), getLocale(), getUserScript(), searchParams,
    ])
    const language = params.lang === "ru" || params.lang === "en" ? params.lang : locale === "ru" ? "ru" : "en"
    const questions = (await loadVocabularyQuestions(language)).map(question => ({
        ...question,
        word: writeOrTranslate(question.word, script),
    }))

    return (
        <main className="min-h-0 flex-1 overflow-y-auto bg-background text-foreground">
            <article className="mx-auto max-w-2xl space-y-5 px-5 py-8">
                <Link href={BEGINNER_ROUTE} className="text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">{t("back")}</Link>
                <h1 className="text-3xl font-bold">{t("title")}</h1>
                <p>{t("description")}</p>
                <nav className="flex flex-wrap items-center gap-2" aria-label={t("translationLanguage")}>
                    <span className="text-sm">{t("translationLanguage")}</span>
                    {(["ru", "en"] as const).map(code => (
                        <Link key={code} href={`${BEGINNER_VOCABULARY}?lang=${code}`} lang={code} aria-current={code === language ? "page" : undefined} className="rounded-lg border px-3 py-2 text-sm aria-[current=page]:bg-muted aria-[current=page]:font-semibold focus-visible:outline-2 focus-visible:outline-primary">
                            {code === "ru" ? "Русский" : "English"}
                        </Link>
                    ))}
                </nav>
                {questions.length ? <VocabularyQuiz key={language} questions={questions} language={language} /> : <p>{t("unavailable")}</p>}
            </article>
        </main>
    )
}
