import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { getItem } from "@/app/words/[id]/api"
import { getUserScript } from "@/lib/get-user-script"
import { buildNounParadigm, toParadigmSource, type NounCase } from "@/lib/paradigm"
import { writeOrTranslate } from "@/lib/script-mode"
import { stripStress } from "@/lib/orthography/standard"
import { FormPractice } from "../FormPractice"

const lessons = {
    singular: [[9849, "gen"], [6813, "dat"], [5728, "acc"], [9849, "ins"], [6813, "loc"], [5728, "voc"]],
    plural: [[9849, "gen"], [18174, "dat"], [13945, "acc"], [9849, "ins"], [18174, "loc"], [17893, "nom"]],
} as const satisfies Record<string, ReadonlyArray<readonly [number, NounCase]>>

const lessonLinks = [
    { number: "singular", href: "/textbook/noun-practice" },
    { number: "plural", href: "/textbook/noun-practice?number=plural" },
] as const

export default async function NounPracticePage({ searchParams }: { searchParams: Promise<{ number?: string | string[] }> }) {
    const number = (await searchParams).number === "plural" ? "plural" : "singular"
    const exercises = lessons[number]
    const [t, script] = await Promise.all([getTranslations("nounPractice"), getUserScript()])
    const ids = [...new Set(exercises.map(([id]) => id))]
    const vocabulary = new Map(await Promise.all(ids.map(async id => {
        const item = await getItem(String(id))
        const forms = item?.isPublic ? buildNounParadigm(toParadigmSource(item)) : null
        return [id, forms] as const
    })))

    const questions = exercises.flatMap(([id, nounCase]) => {
        const forms = vocabulary.get(id)
        const form = forms?.[number][nounCase]
        const lemma = forms?.singular.nom
        if (!form || form === "—" || !lemma || lemma === "—") return []
        const word = writeOrTranslate(stripStress(lemma), script)
        return [{ prompt: t("prompt", { word, nounCase: t(`cases.${nounCase}`) }), answers: [stripStress(form)] }]
    })

    return (
        <main className="min-h-0 flex-1 overflow-y-auto bg-background text-foreground">
            <article className="mx-auto max-w-2xl space-y-5 px-5 py-8">
                <nav aria-label={t("navigation")} className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    <Link href="/textbook/ru#nouns" className="underline">{t("textbook")}</Link>
                    <Link href="/textbook/beginner" className="underline">{t("beginner")}</Link>
                </nav>
                <h1 className="text-3xl font-bold">{t("title")}</h1>
                <nav aria-label={t("lessonNav")} className="flex flex-wrap gap-2">
                    {lessonLinks.map(lesson => (
                        <Link
                            key={lesson.number}
                            href={lesson.href}
                            aria-current={number === lesson.number ? "page" : undefined}
                            className="rounded-lg border px-3 py-2 text-sm aria-[current=page]:bg-muted aria-[current=page]:font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                            {t(lesson.number)}
                        </Link>
                    ))}
                </nav>
                <p>{t(number === "plural" ? "pluralInstructions" : "instructions")}</p>
                {questions.length > 0
                    ? <FormPractice key={number} questions={questions} script={script} />
                    : <p>{t("unavailable")}</p>}
            </article>
        </main>
    )
}
