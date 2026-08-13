'use client'

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"

interface SuggestWordFormProps {
  initialValue?: string
  className?: string
}

export default function SuggestWordForm({ initialValue, className }: SuggestWordFormProps) {
  const t = useTranslations("suggestWord")
  const { data: session } = useSession()
  const [suggestedValue, setSuggestedValue] = useState(initialValue ?? "")
  const [meaningText, setMeaningText] = useState("")
  const [exampleSentence, setExampleSentence] = useState("")
  const [sourceNote, setSourceNote] = useState("")
  const [contact, setContact] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === "submitting" || !meaningText.trim()) return
    setStatus("submitting")
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestedValue: suggestedValue.trim() || undefined,
          meaningText: meaningText.trim(),
          exampleSentence: exampleSentence.trim() || undefined,
          sourceNote: sourceNote.trim() || undefined,
          submitterContact: contact.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error("request failed")
      setStatus("success")
      setSuggestedValue("")
      setMeaningText("")
      setExampleSentence("")
      setSourceNote("")
      setContact("")
    } catch {
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <div className={className}>
        <p className="text-sm">{t("success")}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className || ""}`}>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">{t("valueLabel")}</label>
        <input
          type="text"
          value={suggestedValue}
          onChange={(e) => setSuggestedValue(e.target.value)}
          placeholder={t("valuePlaceholder")}
          maxLength={200}
          className="w-full px-2 py-1.5 text-sm rounded border bg-background"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">{t("meaningLabel")}</label>
        <textarea
          value={meaningText}
          onChange={(e) => setMeaningText(e.target.value)}
          placeholder={t("meaningPlaceholder")}
          rows={3}
          required
          maxLength={1000}
          className="w-full px-2 py-1.5 text-sm rounded border bg-background resize-none"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">{t("exampleLabel")}</label>
        <input
          type="text"
          value={exampleSentence}
          onChange={(e) => setExampleSentence(e.target.value)}
          placeholder={t("examplePlaceholder")}
          maxLength={500}
          className="w-full px-2 py-1.5 text-sm rounded border bg-background"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">{t("sourceNoteLabel")}</label>
        <input
          type="text"
          value={sourceNote}
          onChange={(e) => setSourceNote(e.target.value)}
          placeholder={t("sourceNotePlaceholder")}
          maxLength={200}
          className="w-full px-2 py-1.5 text-sm rounded border bg-background"
        />
      </div>

      {!session?.user && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{t("contactLabel")}</label>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={t("contactPlaceholder")}
            maxLength={200}
            className="w-full px-2 py-1.5 text-sm rounded border bg-background"
          />
        </div>
      )}

      {status === "error" && <p className="text-xs text-red-500">{t("error")}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
      >
        {status === "submitting" ? t("submitting") : t("submit")}
      </button>
    </form>
  )
}
