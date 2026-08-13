'use client'

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"

interface ReportErrorModalProps {
  entityType: "Meaning" | "Translation" | "Lexeme"
  entityId: number
  lexemeId: number
  field?: string
  reportedValue?: string
  className?: string
}

const REASON_CODES = ["wrong_translation", "wrong_meaning", "typo", "grammar", "other"] as const

export default function ReportErrorModal({ entityType, entityId, lexemeId, field, reportedValue, className }: ReportErrorModalProps) {
  const t = useTranslations("report")
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [reasonCode, setReasonCode] = useState<typeof REASON_CODES[number]>("wrong_meaning")
  const [comment, setComment] = useState("")
  const [contact, setContact] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")

  const close = () => {
    setOpen(false)
    setStatus("idle")
    setComment("")
    setContact("")
    setReasonCode("wrong_meaning")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === "submitting") return
    setStatus("submitting")
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          lexemeId,
          field,
          reportedValue,
          reasonCode,
          comment: comment.trim() || undefined,
          submitterContact: contact.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error("request failed")
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setOpen(true)
        }}
        title={t("buttonTitle")}
        aria-label={t("buttonTitle")}
        className={`inline-flex items-center justify-center p-1 rounded-lg transition-colors cursor-pointer text-slate-300 hover:text-red-500 ${className || ""}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="bg-background border rounded-2xl w-full max-w-md shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {status === "success" ? (
              <>
                <p className="text-sm">{t("success")}</p>
                <div className="flex justify-end">
                  <button onClick={close} className="px-4 py-2 border rounded-md text-xs font-semibold hover:bg-muted transition-colors">
                    {t("cancel")}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-base font-bold">{t("title")}</h3>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">{t("reasonLabel")}</label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value as typeof REASON_CODES[number])}
                    className="w-full px-2 py-1.5 text-sm rounded border bg-background"
                  >
                    {REASON_CODES.map((code) => (
                      <option key={code} value={code}>{t(`reasons.${code}`)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">{t("commentLabel")}</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("commentPlaceholder")}
                    rows={3}
                    maxLength={2000}
                    className="w-full px-2 py-1.5 text-sm rounded border bg-background resize-none"
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

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={close} className="px-4 py-2 border rounded-md text-xs font-semibold hover:bg-muted transition-colors">
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
                  >
                    {status === "submitting" ? t("submitting") : t("submit")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
