import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { BEGINNER_FLASHCARDS, BEGINNER_READING, BEGINNER_VOCABULARY, FALSE_FRIENDS, VERB_PRACTICE } from "@/lib/beginner-route"

const steps = [
  { id: "reference", href: "/textbook/phonetic-laws#correspondences" },
  { id: "cards", href: BEGINNER_FLASHCARDS },
  { id: "reading", href: BEGINNER_READING },
] as const

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("beginner")
  return { title: t("title"), description: t("description") }
}

export default async function BeginnerPage() {
  const t = await getTranslations("beginner")
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background text-foreground">
      <article className="mx-auto max-w-2xl space-y-6 px-5 py-8 sm:py-12">
        <header className="space-y-3">
          <Link href="/textbook/ru" className="text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            {t("backToTextbook")}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </header>
        <ol className="ml-5 list-decimal space-y-4 marker:font-semibold marker:text-primary">
          {steps.map(({ id, href }) => (
            <li key={id} className="space-y-1.5 rounded-xl border bg-card p-4">
              <h2 className="text-lg font-semibold">
                <Link href={href} className="text-primary dark:text-blue-400 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                  {t(`${id}.title`)}
                </Link>
              </h2>
              <p className="text-sm text-muted-foreground">{t(`${id}.description`)}</p>
              {id === "reference" && (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <Link href="/textbook/noun-practice" className="text-sm underline focus-visible:outline-2 focus-visible:outline-primary">{t("nounPractice")}</Link>
                  <Link href={VERB_PRACTICE} className="text-sm underline focus-visible:outline-2 focus-visible:outline-primary">{t("verbPractice")}</Link>
                  <Link href={FALSE_FRIENDS} className="text-sm underline focus-visible:outline-2 focus-visible:outline-primary">{t("falseFriends")}</Link>
                </div>
              )}
              {id === "cards" && (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <Link href={BEGINNER_VOCABULARY} className="text-sm underline focus-visible:outline-2 focus-visible:outline-primary">{t("vocabularyQuiz")}</Link>
                  <Link href="/flashcards/print" className="text-sm underline focus-visible:outline-2 focus-visible:outline-primary">{t("printCards")}</Link>
                </div>
              )}
            </li>
          ))}
        </ol>
      </article>
    </main>
  )
}
