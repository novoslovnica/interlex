'use client'

import { useState } from "react"
import { createPortal } from "react-dom"

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
    const [open, setOpen] = useState(false)

    const handleOpen = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation()
        e.preventDefault()
        setOpen(true)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") handleOpen(e)
    }

    const handleClose = () => setOpen(false)

    return (
        <>
            {/* span, не button — этот триггер лежит внутри кнопки разворачивания
                парадигмы (Word.tsx), а вложенные <button> невалидны в HTML и
                вызывают ошибку гидратации. */}
            <span
                onClick={handleOpen}
                onKeyDown={handleKeyDown}
                role="button"
                tabIndex={0}
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-blue-500/70 hover:text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer ${className || ""}`}
                title="Что означают знаки ударения?"
                aria-label="Что означают знаки ударения?"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4.5M12 8.5h.01" />
                </svg>
            </span>

            {open && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
                    onClick={handleClose}
                >
                    <div
                        className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl shadow-xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-sm font-semibold">Четыре тона ударения</h3>
                            <button
                                onClick={handleClose}
                                className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
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
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
