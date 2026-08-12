"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

interface ApiKeySummary {
    id: string
    name: string
    keyPrefix: string
    lastUsedAt: string | null
    requestCount: number
    createdAt: string
    revokedAt: string | null
}

interface JustCreatedKey extends ApiKeySummary {
    rawKey: string
}

function formatDate(value: string | null): string {
    if (!value) return "—"
    return new Date(value).toLocaleString()
}

export function ApiKeysClient() {
    const t = useTranslations("apiKeys")
    const [keys, setKeys] = useState<ApiKeySummary[] | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [name, setName] = useState("")
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const [justCreated, setJustCreated] = useState<JustCreatedKey | null>(null)
    const [revokingId, setRevokingId] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const loadKeys = async () => {
        try {
            const res = await fetch("/api/api-keys")
            if (!res.ok) throw new Error()
            const data = await res.json()
            setKeys(data.keys ?? [])
        } catch {
            setLoadError(t("errors.load"))
        }
    }

    useEffect(() => {
        loadKeys()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleCreate = async () => {
        setCreating(true)
        setCreateError(null)
        try {
            const res = await fetch("/api/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            })
            const data = await res.json()
            if (!res.ok) {
                setCreateError(data.error || t("errors.create"))
                return
            }
            setJustCreated(data)
            setName("")
            setCopied(false)
            await loadKeys()
        } catch {
            setCreateError(t("errors.create"))
        } finally {
            setCreating(false)
        }
    }

    const handleRevoke = async (id: string) => {
        setRevokingId(id)
        try {
            const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error()
            await loadKeys()
        } catch {
            setLoadError(t("errors.revoke"))
        } finally {
            setRevokingId(null)
        }
    }

    const handleCopy = async () => {
        if (!justCreated) return
        try {
            await navigator.clipboard.writeText(justCreated.rawKey)
            setCopied(true)
        } catch {
            // Clipboard API unavailable - the key is still visible to copy manually.
        }
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                <p className="text-muted-foreground text-sm mt-1">{t("description")}</p>
            </div>

            {justCreated && (
                <div className="border rounded-xl bg-amber-500/5 border-amber-500/40 p-6 space-y-3">
                    <p className="text-sm font-bold text-amber-700">{t("revealOnce.title")}</p>
                    <p className="text-xs text-amber-700/90">{t("revealOnce.description")}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <code className="px-3 py-2 rounded-lg bg-background border border-border text-xs font-mono break-all">
                            {justCreated.rawKey}
                        </code>
                        <button
                            onClick={handleCopy}
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted/40"
                        >
                            {copied ? t("revealOnce.copied") : t("revealOnce.copy")}
                        </button>
                    </div>
                    <button
                        onClick={() => setJustCreated(null)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                    >
                        {t("revealOnce.dismiss")}
                    </button>
                </div>
            )}

            <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60 space-y-3">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("createSection")}</h2>
                <div className="flex gap-2 flex-wrap">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("namePlaceholder")}
                        maxLength={60}
                        className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg text-sm bg-background"
                    />
                    <button
                        onClick={handleCreate}
                        disabled={creating || !name.trim()}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                        {creating ? t("creating") : t("createButton")}
                    </button>
                </div>
                {createError && <p className="text-xs text-destructive">{createError}</p>}
            </div>

            <div className="border rounded-xl bg-background shadow-sm border-border/60 overflow-hidden">
                <div className="px-6 py-3 border-b border-border/60">
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("listSection")}</h2>
                </div>
                {loadError && <p className="text-xs text-destructive px-6 py-4">{loadError}</p>}
                {keys === null && !loadError && (
                    <p className="text-xs text-muted-foreground px-6 py-4">{t("loading")}</p>
                )}
                {keys !== null && keys.length === 0 && (
                    <p className="text-xs text-muted-foreground px-6 py-4">{t("empty")}</p>
                )}
                {keys !== null && keys.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                                    <th className="px-6 py-2 font-medium">{t("columns.name")}</th>
                                    <th className="px-6 py-2 font-medium">{t("columns.prefix")}</th>
                                    <th className="px-6 py-2 font-medium">{t("columns.requests")}</th>
                                    <th className="px-6 py-2 font-medium">{t("columns.lastUsed")}</th>
                                    <th className="px-6 py-2 font-medium">{t("columns.created")}</th>
                                    <th className="px-6 py-2 font-medium">{t("columns.status")}</th>
                                    <th className="px-6 py-2 font-medium" />
                                </tr>
                            </thead>
                            <tbody>
                                {keys.map((key) => (
                                    <tr key={key.id} className="border-t border-border/40">
                                        <td className="px-6 py-3 font-medium">{key.name}</td>
                                        <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{key.keyPrefix}…</td>
                                        <td className="px-6 py-3">{key.requestCount}</td>
                                        <td className="px-6 py-3 text-xs text-muted-foreground">{formatDate(key.lastUsedAt)}</td>
                                        <td className="px-6 py-3 text-xs text-muted-foreground">{formatDate(key.createdAt)}</td>
                                        <td className="px-6 py-3">
                                            {key.revokedAt ? (
                                                <span className="text-xs text-destructive">{t("statusRevoked")}</span>
                                            ) : (
                                                <span className="text-xs text-green-600">{t("statusActive")}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            {!key.revokedAt && (
                                                <button
                                                    onClick={() => handleRevoke(key.id)}
                                                    disabled={revokingId === key.id}
                                                    className="text-xs text-destructive hover:underline disabled:opacity-50"
                                                >
                                                    {revokingId === key.id ? t("revoking") : t("revokeButton")}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
