"use client"

import { useState, useTransition } from "react"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import { TRANSLATION_LANGUAGES } from "@/config/features"

type ScriptPreference = "CYRILLIC" | "LATIN"
type ThemePreference = "LIGHT" | "DARK" | "SYSTEM"

interface SettingsClientProps {
    initialScript: ScriptPreference
    initialTheme: ThemePreference
    initialLanguage: string
    onSaveScript: (preference: ScriptPreference) => Promise<void>
    onSaveTheme: (preference: ThemePreference) => Promise<void>
    onSaveLanguage: (language: string) => Promise<void>
}

export function SettingsClient({ initialScript, initialTheme, initialLanguage, onSaveScript, onSaveTheme, onSaveLanguage }: SettingsClientProps) {
    const t = useTranslations("settings")
    const [script, setScript] = useState<ScriptPreference>(initialScript)
    const [theme, setTheme] = useState<ThemePreference>(initialTheme)
    const [language, setLanguage] = useState(initialLanguage)
    const [saving, setSaving] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const { setTheme: applyTheme } = useTheme()

    const LANGUAGE_OPTIONS = [
        { code: "isv", name: t("languageName") },
        ...TRANSLATION_LANGUAGES,
    ] as const

    const handleScriptChange = (selectedScript: ScriptPreference) => {
        if (script === selectedScript) return
        setScript(selectedScript)
        setSaving("script")
        startTransition(async () => {
            try {
                await onSaveScript(selectedScript)
            } catch {
                alert(t("errors.script"))
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
                alert(t("errors.theme"))
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
                alert(t("errors.language"))
                setLanguage(initialLanguage)
            } finally {
                setSaving(null)
            }
        })
    }

    const isSaving = (field: string) => saving === field || isPending

    const themeOptions = [
        { value: "LIGHT" as const, label: t("themeOptions.light"), desc: t("themeOptions.lightDesc") },
        { value: "DARK" as const, label: t("themeOptions.dark"), desc: t("themeOptions.darkDesc") },
        { value: "SYSTEM" as const, label: t("themeOptions.system"), desc: t("themeOptions.systemDesc") },
    ]

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60">
                <div className="space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            {t("sections.script")}
                        </h2>
                        {isSaving("script") && (
                            <span className="text-xs text-blue-600 animate-pulse font-medium">{t("saving")}</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal">
                        {t("scriptDescription")}
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
                                <span className="font-bold text-sm text-foreground">{t("scriptOptions.cyrillic")}</span>
                                <input type="radio" checked={script === "CYRILLIC"} readOnly className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer" />
                            </div>
                            <span className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                                {t("scriptOptions.cyrillicExample")}
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
                                <span className="font-bold text-sm text-foreground">{t("scriptOptions.latin")}</span>
                                <input type="radio" checked={script === "LATIN"} readOnly className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer" />
                            </div>
                            <span className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                                {t("scriptOptions.latinExample")}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60">
                <div className="space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            {t("sections.theme")}
                        </h2>
                        {isSaving("theme") && (
                            <span className="text-xs text-blue-600 animate-pulse font-medium">{t("saving")}</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal">
                        {t("themeDescription")}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                        {themeOptions.map(({ value, label, desc }) => (
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
                            {t("sections.language")}
                        </h2>
                        {isSaving("language") && (
                            <span className="text-xs text-blue-600 animate-pulse font-medium">{t("saving")}</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal">
                        {t("languageDescription")}
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