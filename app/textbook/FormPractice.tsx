"use client"

import { useId, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { ScriptMode, writeOrTranslate } from "@/lib/script-mode"
import { isFormAnswer } from "./form-answer"

interface Question {
    prompt: string
    answers: string[]
}

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
const button = `rounded-lg border px-4 py-2 font-semibold ${focus}`

export function FormPractice({ questions, script }: { questions: Question[]; script: ScriptMode }) {
    const t = useTranslations("nounPractice")
    const [index, setIndex] = useState(0)
    const [answer, setAnswer] = useState("")
    const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null)
    const [score, setScore] = useState(0)
    const inputId = useId()
    const feedbackId = useId()
    const input = useRef<HTMLInputElement>(null)
    const next = useRef<HTMLButtonElement>(null)
    const result = useRef<HTMLHeadingElement>(null)
    const question = questions[index]

    function changeQuestion(newIndex: number) {
        setIndex(newIndex)
        setAnswer("")
        setFeedback(null)
        requestAnimationFrame(() => (newIndex === questions.length ? result.current : input.current)?.focus())
    }

    return (
        <section className="space-y-4 rounded-xl border bg-card p-5">
            {question ? (
                <>
                    <p className="text-sm text-muted-foreground">{t("progress", { current: index + 1, total: questions.length })}</p>
                    <form className="space-y-3" onSubmit={event => {
                        event.preventDefault()
                        if (feedback || !answer.trim()) return
                        const correct = question.answers.some(form => isFormAnswer(answer, form))
                        if (correct) {
                            setScore(score + 1)
                        }
                        setFeedback(correct ? "correct" : "incorrect")
                        requestAnimationFrame(() => next.current?.focus())
                    }}>
                        <label htmlFor={inputId} className="block font-semibold">
                            {question.prompt}
                        </label>
                        <input
                            ref={input}
                            id={inputId}
                            lang="isv"
                            value={answer}
                            onChange={event => setAnswer(event.target.value)}
                            readOnly={feedback !== null}
                            required
                            autoComplete="off"
                            spellCheck={false}
                            className={`block w-full rounded-lg border bg-background px-3 py-2 ${focus}`}
                        />
                        {feedback ? (
                            <button ref={next} type="button" className={button} onClick={() => changeQuestion(index + 1)} aria-describedby={feedbackId}>
                                {t(index + 1 === questions.length ? "finish" : "next")}
                            </button>
                        ) : <button type="submit" className={button}>{t("check")}</button>}
                        <p id={feedbackId} role="status">
                            {feedback && t(feedback, { answer: question.answers.map(form => writeOrTranslate(form, script)).join(" / ") })}
                        </p>
                    </form>
                </>
            ) : (
                <>
                    <h2 ref={result} tabIndex={-1} className="text-xl font-bold">{t("score", { score, total: questions.length })}</h2>
                    <button type="button" className={button} onClick={() => { setScore(0); changeQuestion(0) }}>{t("restart")}</button>
                </>
            )}
        </section>
    )
}
