'use client'

import { useState, useRef, useEffect } from "react"

export default function ShareButton({ className }: { className?: string }) {
    const [copied, setCopied] = useState(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        try {
            await navigator.clipboard.writeText(window.location.href)
        } catch {
            // Фолбэк для окружений без Clipboard API (напр. небезопасный контекст)
            const textarea = document.createElement("textarea")
            textarea.value = window.location.href
            textarea.style.position = "fixed"
            textarea.style.opacity = "0"
            document.body.appendChild(textarea)
            textarea.select()
            try { document.execCommand("copy") } catch {}
            document.body.removeChild(textarea)
        }

        setCopied(true)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setCopied(false), 1800)
    }

    return (
        <div className="relative inline-flex">
            <button
                onClick={handleClick}
                className={`inline-flex items-center justify-center p-1 rounded-lg transition-colors cursor-pointer text-slate-300 hover:text-blue-500 ${className || ""}`}
                title="Поделиться ссылкой"
                aria-label="Поделиться ссылкой"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-5 h-5"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.684 13.342a3 3 0 100-2.684m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m0-9.316a3 3 0 100 2.684m0-2.684a3 3 0 110 2.684m0-2.684L8.684 10.658m6.632 6.658a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684z"
                    />
                </svg>
            </button>

            {copied && (
                <div
                    role="status"
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap px-2.5 py-1 rounded-md bg-slate-800 text-white text-xs font-medium shadow-lg animate-fadeIn z-10"
                >
                    Скопировано!
                </div>
            )}
        </div>
    )
}
