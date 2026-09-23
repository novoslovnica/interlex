"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import { isvToCyr } from "@/lib/isv"
import { ScriptMode } from "@/lib/script-mode"
import { SUGGESTED_VALUE_MAX_LENGTH } from "@/lib/community/constants"
import type { TranslationCard } from "@/lib/community/translationCards"
import type { Verdict } from "@/lib/community/consensus"

interface ContributeClientProps {
    languages: string[]
    currentScript: ScriptMode
}

type LoadState =
    | { kind: "loading" }
    | { kind: "card"; card: TranslationCard; token: string }
    | { kind: "done" }
    | { kind: "error"; code: "generic" | "rateLimited" }

const BUTTON = "px-4 py-3 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50"

export function ContributeClient({ languages, currentScript }: ContributeClientProps) {
    const t = useTranslations("community.contribute")
    const [language, setLanguage] = useState(languages[0])
    const [state, setState] = useState<LoadState>({ kind: "loading" })
    const [answered, setAnswered] = useState(0)
    const [submitting, setSubmitting] = useState(false)
    const [rejecting, setRejecting] = useState(false)
    const [suggestion, setSuggestion] = useState("")

    const loadNext = useCallback(async (lang: string) => {
        setState({ kind: "loading" })
        setRejecting(false)
        setSuggestion("")
        try {
            const response = await fetch(`/api/community/translation-cards/next?lang=${encodeURIComponent(lang)}`)
            if (response.status === 429) return setState({ kind: "error", code: "rateLimited" })
            if (!response.ok) return setState({ kind: "error", code: "generic" })
            const data = await response.json()
            setState(data.done ? { kind: "done" } : { kind: "card", card: data.card, token: data.token })
        } catch {
            setState({ kind: "error", code: "generic" })
        }
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка карточки при смене языка
        loadNext(language)
    }, [language, loadNext])

    const vote = async (verdict: Verdict) => {
        if (state.kind !== "card" || submitting) return
        setSubmitting(true)
        try {
            const response = await fetch("/api/community/translation-cards/vote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    translationId: state.card.translationId,
                    token: state.token,
                    language,
                    verdict,
                    suggestedValue: verdict === "no" ? suggestion : null,
                }),
            })
            if (response.status === 429) return setState({ kind: "error", code: "rateLimited" })
            // 409 - карточку закрыли, пока она была на экране: ответ не нужен, берём следующую.
            if (!response.ok && response.status !== 409) return setState({ kind: "error", code: "generic" })
            if (response.ok) setAnswered((count) => count + 1)
            await loadNext(language)
        } catch {
            setState({ kind: "error", code: "generic" })
        } finally {
            setSubmitting(false)
        }
    }

    const display = (value: string | null) =>
        value ? (currentScript === ScriptMode.CYRILLIC ? isvToCyr(value) : value) : ""
    const languageName = (code: string) => {
        const entry = TRANSLATION_LANGUAGES.find((lang) => lang.code === code)
        return entry ? `${entry.flag} ${entry.name}` : code
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                {languages.length > 1 ? (
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm bg-background"
                    >
                        {languages.map((code) => <option key={code} value={code}>{languageName(code)}</option>)}
                    </select>
                ) : (
                    <span className="text-sm font-medium">{languageName(language)}</span>
                )}
                <span className="text-xs text-muted-foreground">{t("answered", { count: answered })}</span>
            </div>

            <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60 min-h-[18rem] flex flex-col">
                {state.kind === "loading" && <p className="text-sm text-muted-foreground m-auto">{t("loading")}</p>}

                {state.kind === "done" && <p className="text-sm m-auto text-center">{t("done")}</p>}

                {state.kind === "error" && (
                    <div className="m-auto text-center space-y-3">
                        <p className="text-sm text-red-600">{t(`errors.${state.code}`)}</p>
                        <button type="button" onClick={() => loadNext(language)} className={`${BUTTON} border-border`}>
                            {t("retry")}
                        </button>
                    </div>
                )}

                {state.kind === "card" && (
                    <div className="flex flex-col gap-4 flex-1">
                        <div>
                            <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-2xl font-bold">{display(state.card.isv)}</span>
                                {state.card.pos && <span className="text-xs text-muted-foreground">{state.card.pos}</span>}
                                <Link href={`/words/${state.card.lexemeId}`} target="_blank" className="text-xs text-blue-600 ml-auto">
                                    {t("openWord")} ↗
                                </Link>
                            </div>
                            {state.card.meaningText && <p className="text-sm text-muted-foreground mt-1">{state.card.meaningText}</p>}
                            {(state.card.context.ru || state.card.context.en) && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    {[state.card.context.ru && `RU: ${state.card.context.ru}`, state.card.context.en && `EN: ${state.card.context.en}`]
                                        .filter(Boolean).join(" · ")}
                                </p>
                            )}
                        </div>

                        <div className="rounded-lg bg-muted/40 px-4 py-5 text-center">
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("question")}</div>
                            <div className="text-xl font-semibold mt-1 break-words">{state.card.value}</div>
                            <div className="text-[11px] text-muted-foreground mt-2">{t("caseNote")}</div>
                        </div>

                        {rejecting ? (
                            <div className="space-y-2 mt-auto">
                                <label className="block text-xs font-medium">
                                    {t("suggestLabel")}
                                    <input
                                        type="text"
                                        value={suggestion}
                                        maxLength={SUGGESTED_VALUE_MAX_LENGTH}
                                        onChange={(e) => setSuggestion(e.target.value)}
                                        autoFocus
                                        className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background font-normal"
                                    />
                                </label>
                                <div className="flex gap-2">
                                    <button type="button" disabled={submitting} onClick={() => vote("no")} className={`${BUTTON} flex-1 bg-red-600 text-white border-red-600`}>
                                        {t("confirmWrong")}
                                    </button>
                                    <button type="button" disabled={submitting} onClick={() => setRejecting(false)} className={`${BUTTON} border-border`}>
                                        {t("cancel")}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 mt-auto">
                                <button type="button" disabled={submitting} onClick={() => vote("yes")} className={`${BUTTON} bg-green-600 text-white border-green-600`}>
                                    {t("correct")}
                                </button>
                                <button type="button" disabled={submitting} onClick={() => setRejecting(true)} className={`${BUTTON} bg-red-600 text-white border-red-600`}>
                                    {t("wrong")}
                                </button>
                                <button type="button" disabled={submitting} onClick={() => vote("unknown")} className={`${BUTTON} border-border`}>
                                    {t("unknown")}
                                </button>
                                <button type="button" disabled={submitting} onClick={() => loadNext(language)} className={`${BUTTON} border-border`}>
                                    {t("skip")}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <p className="text-xs text-muted-foreground">{t("howItWorks")}</p>
        </div>
    )
}
