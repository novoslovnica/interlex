"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import { HANDLE_MAX_LENGTH, BIO_MAX_LENGTH } from "@/lib/community/handle"
import type { SaveProfileResult, UserLanguageInput } from "./actions"

type Level = "native" | "fluent"

interface CommunitySettingsProps {
    initialLanguages: UserLanguageInput[]
    initialHandle: string | null
    initialBio: string | null
    onSaveLanguages: (languages: UserLanguageInput[]) => Promise<void>
    onSaveProfile: (handle: string, bio: string) => Promise<SaveProfileResult>
    onDeleteProfile: () => Promise<void>
}

const CARD = "border rounded-xl bg-background p-6 shadow-sm border-border/60"
const CARD_TITLE = "text-sm font-bold text-muted-foreground uppercase tracking-wider"

export function CommunitySettings({
    initialLanguages, initialHandle, initialBio, onSaveLanguages, onSaveProfile, onDeleteProfile,
}: CommunitySettingsProps) {
    const t = useTranslations("community.settings")
    const [levels, setLevels] = useState<Record<string, Level>>(
        () => Object.fromEntries(initialLanguages.map((entry) => [entry.language, entry.level as Level]))
    )
    const [savedHandle, setSavedHandle] = useState(initialHandle)
    const [handle, setHandle] = useState(initialHandle ?? "")
    const [bio, setBio] = useState(initialBio ?? "")
    const [profileStatus, setProfileStatus] = useState<{ kind: "saved" } | { kind: "error"; code: string } | null>(null)
    const [savingLanguages, startLanguagesTransition] = useTransition()
    const [savingProfile, startProfileTransition] = useTransition()

    const persistLevels = (next: Record<string, Level>) => {
        const previous = levels
        setLevels(next)
        startLanguagesTransition(async () => {
            try {
                await onSaveLanguages(Object.entries(next).map(([language, level]) => ({ language, level })))
            } catch {
                alert(t("errors.generic"))
                setLevels(previous)
            }
        })
    }

    const toggleLanguage = (code: string) => {
        const next = { ...levels }
        if (next[code]) delete next[code]
        else next[code] = "native"
        persistLevels(next)
    }

    const submitProfile = () => {
        setProfileStatus(null)
        startProfileTransition(async () => {
            try {
                const result = await onSaveProfile(handle, bio)
                if (result.ok) {
                    setSavedHandle(result.handle)
                    setHandle(result.handle)
                    setProfileStatus({ kind: "saved" })
                } else {
                    setProfileStatus({ kind: "error", code: result.error })
                }
            } catch {
                setProfileStatus({ kind: "error", code: "generic" })
            }
        })
    }

    const removeProfile = () => {
        if (!confirm(t("removeConfirm"))) return
        setProfileStatus(null)
        startProfileTransition(async () => {
            try {
                await onDeleteProfile()
                setSavedHandle(null)
                setHandle("")
                setBio("")
            } catch {
                setProfileStatus({ kind: "error", code: "generic" })
            }
        })
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div className={CARD}>
                <div className="space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h2 className={CARD_TITLE}>{t("languagesTitle")}</h2>
                        {savingLanguages && <span className="text-xs text-blue-600 animate-pulse font-medium">…</span>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal">{t("languagesDescription")}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                        {TRANSLATION_LANGUAGES.map((lang) => {
                            const level = levels[lang.code]
                            return (
                                <div
                                    key={lang.code}
                                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                        level ? "bg-blue-500/10 border-blue-500" : "bg-background border-border"
                                    }`}
                                >
                                    <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(level)}
                                            onChange={() => toggleLanguage(lang.code)}
                                            className="h-4 w-4"
                                        />
                                        <span className="truncate">{lang.flag} {lang.name}</span>
                                    </label>
                                    {level && (
                                        <select
                                            value={level}
                                            onChange={(e) => persistLevels({ ...levels, [lang.code]: e.target.value as Level })}
                                            className="text-xs border rounded px-1 py-0.5 bg-background"
                                        >
                                            <option value="native">{t("levelNative")}</option>
                                            <option value="fluent">{t("levelFluent")}</option>
                                        </select>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    {Object.keys(levels).length === 0 && (
                        <p className="text-xs text-muted-foreground">{t("languagesEmpty")}</p>
                    )}
                </div>
            </div>

            <div className={CARD}>
                <div className="space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h2 className={CARD_TITLE}>{t("profileTitle")}</h2>
                        {savedHandle && (
                            <Link href={`/u/${savedHandle}`} className="text-xs text-blue-600 font-medium">
                                {t("profileLink")} →
                            </Link>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal">{t("profileDescription")}</p>
                    <label className="block text-xs font-medium pt-2">
                        {t("handleLabel")}
                        <input
                            type="text"
                            value={handle}
                            maxLength={HANDLE_MAX_LENGTH}
                            onChange={(e) => setHandle(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background font-normal"
                        />
                    </label>
                    <p className="text-[11px] text-muted-foreground">{t("handleHint")}</p>
                    <label className="block text-xs font-medium">
                        {t("bioLabel")}
                        <textarea
                            value={bio}
                            maxLength={BIO_MAX_LENGTH}
                            onChange={(e) => setBio(e.target.value)}
                            rows={2}
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background font-normal"
                        />
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={submitProfile}
                            disabled={savingProfile || handle.trim() === ""}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                        >
                            {t("save")}
                        </button>
                        {savedHandle && (
                            <button
                                type="button"
                                onClick={removeProfile}
                                disabled={savingProfile}
                                className="text-sm text-red-600 disabled:opacity-50"
                            >
                                {t("remove")}
                            </button>
                        )}
                        {profileStatus?.kind === "saved" && <span className="text-xs text-green-600">{t("saved")}</span>}
                        {profileStatus?.kind === "error" && (
                            <span className="text-xs text-red-600">{t(`errors.${profileStatus.code}`)}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
