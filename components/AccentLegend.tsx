'use client'

import { useId, useRef } from "react"

// Четыре тона по системе Зализняка (см. lib/grammar/fourTonesGenerator.ts,
// FourSlavicTones) — та же система, что генерирует акцентовку в парадигмах.
const TONES: { mark: string; unicode: string; name: string; description: string }[] = [
    {
        mark: "á",
        unicode: "U+0301, акут",
        name: "Долгое восходящее (акут)",
        description: "На долгом гласном тон плавно повышается к концу слога — «острое» ударение.",
    },
    {
        mark: "à",
        unicode: "U+0300, гравис",
        name: "Краткое восходящее (гравис)",
        description: "Ударение на кратком гласном без выраженного движения тона — просто краткий ударный слог.",
    },
    {
        mark: "â",
        unicode: "U+0302, циркумфлекс",
        name: "Долгое нисходящее (циркумфлекс)",
        description: "На долгом гласном тон начинается высоко и понижается к концу слога.",
    },
    {
        mark: "ȃ",
        unicode: "U+0311, перевёрнутая дуга",
        name: "Краткое нисходящее",
        description: "То же движение тона, что и у циркумфлекса, но на кратком гласном — резкое, отрывистое понижение.",
    },
]

export default function AccentLegend({ className }: { className?: string }) {
    const dialog = useRef<HTMLDialogElement>(null)
    const titleId = useId()

    return (
        <>
            <button
                type="button"
                onClick={() => dialog.current?.showModal()}
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-blue-700 hover:bg-blue-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${className || ""}`}
                aria-haspopup="dialog"
                aria-label="Что означают знаки ударения?"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4.5M12 8.5h.01" />
                </svg>
            </button>

            <dialog
                ref={dialog}
                aria-labelledby={titleId}
                onClick={event => {
                    if (event.target === event.currentTarget) event.currentTarget.close()
                }}
                className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md max-h-[85vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl backdrop:bg-black/30 dark:bg-slate-800 dark:text-slate-100"
            >
                <div className="flex items-center justify-between mb-1">
                    <h3 id={titleId} className="text-sm font-semibold">Четыре тона ударения</h3>
                    <button
                        type="button"
                        onClick={() => dialog.current?.close()}
                        className="p-1 rounded text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        aria-label="Закрыть"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Система четырёх тонов Зализняка (пример на букве «а»):
                </p>
                <div className="space-y-3">
                    {TONES.map((tone) => (
                        <div key={tone.unicode} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                            <div className="text-3xl font-serif font-bold w-10 shrink-0 text-center text-blue-700 dark:text-blue-400">
                                {tone.mark}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {tone.name}
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mb-0.5">
                                    {tone.unicode}
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-300">
                                    {tone.description}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </dialog>
        </>
    )
}
