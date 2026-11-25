import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { getItem, getKnownPrepositions } from "@/app/words/[id]/api"
import { BEGINNER_ROUTE, VERB_PRACTICE } from "@/lib/beginner-route"
import { VerbalAspect } from "@/lib/grammar/common"
import { getUserScript } from "@/lib/get-user-script"
import { stripStress } from "@/lib/orthography/standard"
import { buildVerbParadigm, toParadigmSource } from "@/lib/paradigm"
import { writeOrTranslate } from "@/lib/script-mode"
import { FormPractice } from "../FormPractice"

const exercises = [
    [22223, "1sg"], // znati, with both full and contracted forms
    [7938, "2sg"],  // govoriti
    [6166, "3sg"],  // čitati
    [12826, "1pl"], // nesti
    [10943, "2pl"], // ljubiti
    [20974, "3pl"], // viděti
] as const

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("verbPractice")
    return { title: t("title"), description: t("instructions"), alternates: { canonical: VERB_PRACTICE } }
}

export default async function VerbPracticePage() {
    const [t, nav, script, prepositions] = await Promise.all([
        getTranslations("verbPractice"), getTranslations("nounPractice"), getUserScript(), getKnownPrepositions(),
    ])
    const exercisesWithForms = await Promise.all(exercises.map(async ([id, person]) => {
        const item = await getItem(String(id))
        if (!item?.isPublic || item.aspect !== VerbalAspect.IPF) return null
        const paradigm = buildVerbParadigm(toParadigmSource(item), prepositions)
        if (!paradigm?.infinitive) return null
        const { presentOrFutureDirect, presentOrFutureDirectShort } = paradigm.indicative
        const answers = [...new Set(
            [presentOrFutureDirect[person], presentOrFutureDirectShort?.[person]]
                .filter((form): form is string => Boolean(form) && form !== "—")
                .map(stripStress),
        )]
        if (!answers.length) return null
        const word = writeOrTranslate(stripStress(paradigm.infinitive), script)
        return { prompt: t("prompt", { word, person: t(`persons.${person}`) }), answers }
    }))
    const questions = exercisesWithForms.filter(question => question !== null)

    return (
        <main className="min-h-0 flex-1 overflow-y-auto bg-background text-foreground">
            <article className="mx-auto max-w-2xl space-y-5 px-5 py-8">
                <nav aria-label={nav("navigation")} className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    <Link href="/textbook/ru#verbs-present" className="underline">{nav("textbook")}</Link>
                    <Link href={BEGINNER_ROUTE} className="underline">{nav("beginner")}</Link>
                </nav>
                <h1 className="text-3xl font-bold">{t("title")}</h1>
                <p>{t("instructions")}</p>
                {questions.length > 0
                    ? <FormPractice questions={questions} script={script} />
                    : <p>{nav("unavailable")}</p>}
            </article>
        </main>
    )
}
