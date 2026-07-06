"use client"

import { useState, useTransition } from "react"
import { useTheme } from "next-themes"
import { TRANSLATION_LANGUAGES } from "@/config/features"

type ScriptPreference = "CYRILLIC" | "LATIN"
type ThemePreference = "LIGHT" | "DARK" | "SYSTEM"

const LANGUAGE_OPTIONS = [
    { code: "isv", name: "Междуславянский" },
    ...TRANSLATION_LANGUAGES,
] as const

interface SettingsClientProps {
    initialScript: ScriptPreference
    initialTheme: ThemePreference
    initialLanguage: string
    onSaveScript: (preference: ScriptPreference) => Promise<void>
    onSaveTheme: (preference: ThemePreference) => Promise<void>
    onSaveLanguage: (language: string) => Promise<void>
}

export function SettingsClient({ initialScript, initialTheme, initialLanguage, onSaveScript, onSaveTheme, onSaveLanguage }: SettingsClientProps) {
    const [script, setScript] = useState<ScriptPreference>(initialScript)
    const [theme, setTheme] = useState<ThemePreference>(initialTheme)
    const [language, setLanguage] = useState(initialLanguage)
    const [saving, setSaving] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const { setTheme: applyTheme } = useTheme()

    const handleScriptChange = (selectedScript: ScriptPreference) => {
        if (script === selectedScript) return
        setScript(selectedScript)
        setSaving("script")
        startTransition(async () => {
            try {
                await onSaveScript(selectedScript)
            } catch {
                alert("Не удалось сохранить настройку письменности")
                setScript(initialScript)
            } finally {
                setSaving(null)
            }
        })
    }

    const handleThemeChange = (selectedTheme: ThemePreference) => {
        if (theme === selectedTheme) return
        setTheme(selectedTheme)
        applyTheme(selectedTheme === "SYSTEM" ? "system" : selectedTheme.toLowerCase())
        setSaving("theme")
        startTransition(async () => {
            try {
                await onSaveTheme(selectedTheme)
            } catch {
                alert("Не удалось сохранить настройку темы")
                setTheme(initialTheme)
                applyTheme(initialTheme === "SYSTEM" ? "system" : initialTheme.toLowerCase())
            } finally {
                setSaving(null)
            }
        })
    }

    const handleLanguageChange = (selectedLanguage: string) => {
        if (language === selectedLanguage) return
        setLanguage(selectedLanguage)
        setSaving("language")
        startTransition(async () => {
            try {
                await onSaveLanguage(selectedLanguage)
            } catch {
                alert("Не удалось сохранить настройку языка")
                setLanguage(initialLanguage)
            } finally {
                setSaving(null)
            }
        })
    }

    const isSaving = (field: string) => saving === field || isPending

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60">
                <div className="space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            Отображение письменности (Алфавит)
                        </h2>
                        {isSaving("script") && (
                            <span className="text-xs text-blue-600 animate-pulse font-medium">Сохраняю...</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal">
                        Выберите, какую графическую систему (скрипт) использовать по умолчанию для вывода межславянских слов в интерфейсах лексикона и таблицах.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
                                <input type="radio" checked={script === "CYRILLIC"} readOnly className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer" />
                            </div>
                            <span className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                                Пример вывода: <span className="font-semibold text-foreground">меджуславянскы</span>
                            </span>
                        </div>
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
                                <input type="radio" checked={script === "LATIN"} readOnly className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer" />
                            </div>
                            <span className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                                Пример вывода: <span className="font-semibold text-foreground">medžuslavjanski</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60">
                <div className="space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            Тема оформления
                        </h2>
                        {isSaving("theme") && (
                            <span className="text-xs text-blue-600 animate-pulse font-medium">Сохраняю...</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal">
                        Выберите тему оформления сайта. Системная автоматически следует настройкам вашей операционной системы.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                        {[
                            { value: "LIGHT" as const, label: "Светлая", desc: "Всегда светлый фон" },
                            { value: "DARK" as const, label: "Тёмная", desc: "Всегда тёмный фон" },
                            { value: "SYSTEM" as const, label: "Системная", desc: "Как в ОС" },
                        ].map(({ value, label, desc }) => (
                            <div
                                key={value}
                                onClick={() => handleThemeChange(value)}
                                className={`p-4 rounded-xl border flex flex-col justify-between cursor-pointer select-none transition-all ${
                                    theme === value
                                        ? "bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/20"
                                        : "bg-background border-border hover:bg-muted/40"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-sm text-foreground">{label}</span>
                                    <input type="radio" checked={theme === value} readOnly className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer" />
                                </div>
                                <span className="text-[11px] text-muted-foreground mt-2">{desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60">
                <div className="space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            Язык по умолчанию
                        </h2>
                        {isSaving("language") && (
                            <span className="text-xs text-blue-600 animate-pulse font-medium">Сохраняю...</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal">
                        Выберите язык интерфейса и переводов по умолчанию. Настройка пока не влияет на функционал, но будет использоваться в будущем.
                    </p>
                    <select
                        value={language}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-background mt-2"
                    >
                        {LANGUAGE_OPTIONS.map((lang) => (
                            <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    )
}