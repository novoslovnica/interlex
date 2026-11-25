"use client"

import { useId, useRef, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { BEGINNER_FLASHCARDS } from "@/lib/beginner-route"
import { recommendVocabularyLevel, VOCABULARY_LEVELS, type QuizLanguage, type VocabularyQuestion } from "@/lib/vocabulary/assessment"

const button = "rounded-lg border px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"

export function VocabularyQuiz({ questions, language }: { questions: VocabularyQuestion[]; language: QuizLanguage }) {
    const t = useTranslations("vocabulary")
    const [answers, setAnswers] = useState<number[]>([])
    const [choice, setChoice] = useState<number | null>(null)
    const heading = useRef<HTMLHeadingElement>(null)
    const progressId = useId()
    const question = questions[answers.length]

    function advance(answer: number) {
        setAnswers(current => [...current, answer])
        setChoice(null)
        requestAnimationFrame(() => heading.current?.focus())
    }

    if (!question) {
        const result = recommendVocabularyLevel(questions, answers)
        return (
            <section className="space-y-4 rounded-xl border bg-card p-5">
                <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">{t("result", { level: result.level })}</h2>
                <p>{t("score", { count: result.correct, total: questions.length })}</p>
                <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    {VOCABULARY_LEVELS.map(level => <li key={level}>{t("levelScore", { level, count: result.scores[level] })}</li>)}
                </ul>
                <div className="flex flex-wrap gap-2">
                    <Link className={button} href={`${BEGINNER_FLASHCARDS}&level=${result.level}&lang=${language}`}>{t("train", { level: result.level })}</Link>
                    <button type="button" className={button} onClick={() => {
                        setAnswers([])
                        setChoice(null)
                        requestAnimationFrame(() => heading.current?.focus())
                    }}>{t("restart")}</button>
                </div>
            </section>
        )
    }

    return (
        <form className="space-y-4 rounded-xl border bg-card p-5" onSubmit={event => {
            event.preventDefault()
            if (choice !== null) advance(choice)
        }}>
            <p id={progressId} className="text-sm text-muted-foreground">{t("progress", { current: answers.length + 1, total: questions.length })}</p>
            <h2 ref={heading} tabIndex={-1} aria-describedby={progressId} lang="isv" className="text-2xl font-bold">{question.word}</h2>
            <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">{t("choose")}</legend>
                {question.options.map((option, index) => (
                    <label key={option} lang={language} className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
                        <input type="radio" name="answer" className="mt-1 shrink-0" checked={choice === index} onChange={() => setChoice(index)} />
                        <span className="min-w-0 wrap-break-word">{option}</span>
                    </label>
                ))}
            </fieldset>
            <div className="flex flex-wrap gap-2">
                <button type="submit" className={`${button} disabled:opacity-50`} disabled={choice === null}>
                    {t(answers.length === questions.length - 1 ? "finish" : "next")}
                </button>
                <button type="button" className={button} onClick={() => advance(-1)}>{t("skip")}</button>
            </div>
        </form>
    )
}
