"use client"

import { useState, useTransition } from "react"

// Описываем тип локально в виде строк, полностью изолируя клиент от Prisma
type ScriptPreference = "CYRILLIC" | "LATIN"

interface SettingsClientProps {
    initialScript: ScriptPreference
    onSaveScript: (preference: ScriptPreference) => Promise<void>
}

export function SettingsClient({ initialScript, onSaveScript }: SettingsClientProps) {
    const [script, setScript] = useState<ScriptPreference>(initialScript)
    const [isPending, startTransition] = useTransition()

    const handleScriptChange = (selectedScript: ScriptPreference) => {
        if (script === selectedScript) return

        setScript(selectedScript)

        startTransition(async () => {
            try {
                await onSaveScript(selectedScript)
            } catch (error) {
                alert("Не удалось сохранить настройку")
                setScript(initialScript)
            }
        })
    }

    return (
        <div className="border rounded-xl bg-background p-6 shadow-sm max-w-2xl border-border/60">
            <div className="space-y-6">

                <div className="space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            Отображение письменности (Алфавит)
                        </h2>
                        {isPending && (
                            <span className="text-xs text-blue-600 animate-pulse font-medium">Сохраняю...</span>
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-normal">
                        Выберите, какую графическую систему (скрипт) использовать по умолчанию для вывода межславянских слов в интерфейсах лексикона и таблицах.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">

                        {/* Карточка 1: Кириллица */}
                        <div
                            onClick={() => handleScriptChange("CYRILLIC")}
                            className={`p-4 rounded-xl border flex flex-col justify-between cursor-pointer select-none transition-all ${
                                script === "CYRILLIC"
                                    ? "bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/20"
                                    : "bg-background border-border hover:bg-muted/40"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-foreground">Кириллица</span>
                                <input
                                    type="radio"
                                    checked={script === "CYRILLIC"}
                                    readOnly
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                />
                            </div>
                            <span className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                Пример вывода: <span className="font-semibold text-foreground">меджуславянскы</span>
              </span>
                        </div>

                        {/* Карточка 2: Латиница */}
                        <div
                            onClick={() => handleScriptChange("LATIN")}
                            className={`p-4 rounded-xl border flex flex-col justify-between cursor-pointer select-none transition-all ${
                                script === "LATIN"
                                    ? "bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/20"
                                    : "bg-background border-border hover:bg-muted/40"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-foreground">Латиница</span>
                                <input
                                    type="radio"
                                    checked={script === "LATIN"}
                                    readOnly
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                />
                            </div>
                            <span className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                Пример вывода: <span className="font-semibold text-foreground">medžuslavjanski</span>
              </span>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    )
}
