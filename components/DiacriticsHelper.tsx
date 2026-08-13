"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

// Roadmap #35 - most keyboards have no key for ę/ų/ć/đ/ľ/ń/ś/ź/ť/ď (Latin) or
// і/ѣ/ѧ/ѫ/ѕ/џ (etymological Cyrillic), so typing real ISV text means either
// memorizing OS-level compose sequences or copy-pasting from elsewhere. This
// is a click-to-insert palette, not auto-substitution (e.g. "e'" -> "ę") -
// substitution risks silently mangling text a user meant literally, and a
// visible palette also doubles as a discoverability aid for which letters
// even exist in ISV orthography.
const LATIN_CHARS = ["č", "š", "ž", "ě", "ę", "ų", "ć", "đ", "ľ", "ń", "ś", "ź", "ť", "ď"]

// Etymological Cyrillic-only letters (isvToCyrOld/New in lib/isv.ts) that
// don't exist on a standard Russian keyboard layout - plain modern Cyrillic
// (а-я) needs no help here, mapNslToEtymologized already accepts it as-is.
const CYRILLIC_CHARS = ["і", "ѣ", "ѧ", "ѫ", "ѕ", "џ", "ј", "ы"]

export type DiacriticsMode = "latin" | "cyrillic" | "both"

interface DiacriticsHelperProps {
    targetRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
    value: string
    onChange: (value: string) => void
    mode?: DiacriticsMode
    /** Which tab is active when mode="both" - lets a parent's own script toggle (Lat/Кир) drive this. */
    defaultPanel?: "latin" | "cyrillic"
    /** Applied to the outer wrapper - use for positioning the whole widget (e.g. "absolute top-2 right-2"). The inner anchor stays position:relative regardless, so a caller's own "absolute" here never collides with it. */
    className?: string
}

export default function DiacriticsHelper({ targetRef, value, onChange, mode = "both", defaultPanel, className }: DiacriticsHelperProps) {
    const [open, setOpen] = useState(false)
    const [panel, setPanel] = useState<"latin" | "cyrillic">(mode === "cyrillic" ? "cyrillic" : defaultPanel ?? "latin")
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (mode !== "both") {
            setPanel(mode)
        } else if (defaultPanel) {
            setPanel(defaultPanel)
        }
    }, [mode, defaultPanel])

    useEffect(() => {
        if (!open) return
        const onDocMouseDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", onDocMouseDown)
        document.addEventListener("keydown", onKeyDown)
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown)
            document.removeEventListener("keydown", onKeyDown)
        }
    }, [open])

    const insertChar = useCallback((char: string) => {
        const el = targetRef.current
        if (!el) {
            onChange(value + char)
            return
        }
        const start = el.selectionStart ?? value.length
        const end = el.selectionEnd ?? value.length
        onChange(value.slice(0, start) + char + value.slice(end))
        const nextPos = start + char.length
        requestAnimationFrame(() => {
            el.focus()
            el.setSelectionRange(nextPos, nextPos)
        })
    }, [targetRef, value, onChange])

    const chars = panel === "latin" ? LATIN_CHARS : CYRILLIC_CHARS

    return (
        <div className={className}>
            <div ref={containerRef} className="relative">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    title="Диакритика ISV"
                    aria-label="Диакритика ISV"
                    aria-expanded={open}
                    className="flex h-full items-center justify-center px-2.5 rounded-lg border border-border/60 bg-background text-sm font-serif text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                    ę̂
                </button>
                {open && (
                    <div className="absolute z-50 top-full right-0 mt-1 w-56 rounded-lg border border-border/60 bg-background p-2 shadow-lg">
                        {mode === "both" && (
                            <div className="flex gap-1 mb-2">
                                <button
                                    type="button"
                                    onClick={() => setPanel("latin")}
                                    className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${panel === "latin" ? "bg-blue-600 text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
                                >
                                    Lat
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPanel("cyrillic")}
                                    className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${panel === "cyrillic" ? "bg-blue-600 text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
                                >
                                    Кир
                                </button>
                            </div>
                        )}
                        <div className="grid grid-cols-5 gap-1">
                            {chars.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => insertChar(c)}
                                    className="rounded border border-border/40 py-1.5 text-base hover:bg-muted/60 transition-colors"
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
