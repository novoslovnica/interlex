"use client"

import { useMemo, useState } from "react"

type ParamKind = "text" | "number"

interface EndpointParam {
    name: string
    kind: ParamKind
    in: "path" | "query" | "body"
    defaultValue: string
    placeholder?: string
    optional?: boolean
}

interface EndpointConfig {
    id: string
    label: string
    method: "GET" | "POST"
    // Playground path (no API key) - :param placeholders filled from path params.
    playgroundPath: string
    // Real public path, for the curl equivalent shown alongside the result.
    publicPath: string
    params: EndpointParam[]
}

const ENDPOINTS: EndpointConfig[] = [
    {
        id: "words-list",
        label: "GET /words",
        method: "GET",
        playgroundPath: "/api/playground/v1/words",
        publicPath: "/api/public/v1/words",
        params: [
            { name: "search", kind: "text", in: "query", defaultValue: "voda" },
            { name: "limit", kind: "number", in: "query", defaultValue: "10" },
            { name: "offset", kind: "number", in: "query", defaultValue: "0" },
        ],
    },
    {
        id: "words-detail",
        label: "GET /words/:slug",
        method: "GET",
        playgroundPath: "/api/playground/v1/words/:slug",
        publicPath: "/api/public/v1/words/:slug",
        params: [{ name: "slug", kind: "text", in: "path", defaultValue: "voda-NOUN" }],
    },
    {
        id: "proto-list",
        label: "GET /proto",
        method: "GET",
        playgroundPath: "/api/playground/v1/proto",
        publicPath: "/api/public/v1/proto",
        params: [
            { name: "search", kind: "text", in: "query", defaultValue: "voda" },
            { name: "limit", kind: "number", in: "query", defaultValue: "10" },
            { name: "offset", kind: "number", in: "query", defaultValue: "0" },
        ],
    },
    {
        id: "proto-detail",
        label: "GET /proto/:id",
        method: "GET",
        playgroundPath: "/api/playground/v1/proto/:id",
        publicPath: "/api/public/v1/proto/:id",
        params: [{ name: "id", kind: "number", in: "path", defaultValue: "1" }],
    },
    {
        id: "library-list",
        label: "GET /library",
        method: "GET",
        playgroundPath: "/api/playground/v1/library",
        publicPath: "/api/public/v1/library",
        params: [
            { name: "search", kind: "text", in: "query", defaultValue: "princ" },
            { name: "limit", kind: "number", in: "query", defaultValue: "10" },
            { name: "offset", kind: "number", in: "query", defaultValue: "0" },
        ],
    },
    {
        id: "library-detail",
        label: "GET /library/:slug",
        method: "GET",
        playgroundPath: "/api/playground/v1/library/:slug",
        publicPath: "/api/public/v1/library/:slug",
        params: [{ name: "slug", kind: "text", in: "path", defaultValue: "maly-princ" }],
    },
    {
        id: "corpus-kwic",
        label: "POST /corpus/kwic",
        method: "POST",
        playgroundPath: "/api/playground/v1/corpus/kwic",
        publicPath: "/api/public/v1/corpus/kwic",
        params: [
            { name: "query", kind: "text", in: "body", defaultValue: '[lemma="dom"]' },
            { name: "limit", kind: "number", in: "body", defaultValue: "10" },
            { name: "offset", kind: "number", in: "body", defaultValue: "0" },
            { name: "documentSlug", kind: "text", in: "body", defaultValue: "", optional: true },
        ],
    },
]

function buildDefaultValues(endpoint: EndpointConfig): Record<string, string> {
    const values: Record<string, string> = {}
    for (const p of endpoint.params) values[p.name] = p.defaultValue
    return values
}

function fillPath(template: string, values: Record<string, string>, params: EndpointParam[]): string {
    let path = template
    for (const p of params) {
        if (p.in === "path") path = path.replace(`:${p.name}`, encodeURIComponent(values[p.name] ?? ""))
    }
    return path
}

function buildQueryString(params: EndpointParam[], values: Record<string, string>): string {
    const usp = new URLSearchParams()
    for (const p of params) {
        if (p.in !== "query") continue
        const v = values[p.name]
        if (v === undefined || v === "") continue
        usp.set(p.name, v)
    }
    const qs = usp.toString()
    return qs ? `?${qs}` : ""
}

function buildBody(params: EndpointParam[], values: Record<string, string>): Record<string, unknown> {
    const body: Record<string, unknown> = {}
    for (const p of params) {
        if (p.in !== "body") continue
        const v = values[p.name]
        if (v === undefined || v === "") continue
        body[p.name] = p.kind === "number" ? Number(v) : v
    }
    return body
}

function buildCurl(endpoint: EndpointConfig, values: Record<string, string>): string {
    const pathParams = endpoint.params.filter((p) => p.in === "path")
    const path = fillPath(endpoint.publicPath, values, pathParams)
    if (endpoint.method === "GET") {
        const qs = buildQueryString(endpoint.params, values)
        return `curl -H "Authorization: Bearer islx_..." \\\n  "https://interslavic-lexicon.com${path}${qs}"`
    }
    const body = buildBody(endpoint.params, values)
    return `curl -X POST -H "Authorization: Bearer islx_..." -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body)}' \\\n  "https://interslavic-lexicon.com${path}"`
}

interface ResultState {
    status: number
    ok: boolean
    body: string
    rateLimitRemaining: string | null
}

export default function PlaygroundClient() {
    const [endpointId, setEndpointId] = useState(ENDPOINTS[0].id)
    const endpoint = useMemo(() => ENDPOINTS.find((e) => e.id === endpointId)!, [endpointId])
    const [values, setValues] = useState<Record<string, string>>(() => buildDefaultValues(ENDPOINTS[0]))
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<ResultState | null>(null)

    const selectEndpoint = (id: string) => {
        setEndpointId(id)
        const found = ENDPOINTS.find((e) => e.id === id)!
        setValues(buildDefaultValues(found))
        setResult(null)
    }

    const setParam = (name: string, value: string) => {
        setValues((prev) => ({ ...prev, [name]: value }))
    }

    const runRequest = async () => {
        setLoading(true)
        setResult(null)
        try {
            const pathParams = endpoint.params.filter((p) => p.in === "path")
            const path = fillPath(endpoint.playgroundPath, values, pathParams)
            let res: Response
            if (endpoint.method === "GET") {
                const qs = buildQueryString(endpoint.params, values)
                res = await fetch(`${path}${qs}`)
            } else {
                const body = buildBody(endpoint.params, values)
                res = await fetch(path, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                })
            }
            const text = await res.text()
            let pretty = text
            try {
                pretty = JSON.stringify(JSON.parse(text), null, 2)
            } catch {
                // leave as raw text
            }
            setResult({
                status: res.status,
                ok: res.ok,
                body: pretty,
                rateLimitRemaining: res.headers.get("X-RateLimit-Remaining"),
            })
        } catch (e) {
            setResult({ status: 0, ok: false, body: e instanceof Error ? e.message : "Network error", rateLimitRemaining: null })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {ENDPOINTS.map((e) => (
                    <button
                        key={e.id}
                        type="button"
                        onClick={() => selectEndpoint(e.id)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-mono transition-colors ${
                            e.id === endpointId
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "border-border/60 bg-background text-muted-foreground hover:bg-muted/60"
                        }`}
                    >
                        {e.label}
                    </button>
                ))}
            </div>

            <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                    {endpoint.params.map((p) => (
                        <label key={p.name} className="text-xs space-y-1 block">
                            <span className="font-mono text-muted-foreground">
                                {p.name}
                                {p.in === "path" && " (path)"}
                                {p.optional && " (optional)"}
                            </span>
                            <input
                                type={p.kind === "number" ? "number" : "text"}
                                value={values[p.name] ?? ""}
                                onChange={(e) => setParam(p.name, e.target.value)}
                                placeholder={p.placeholder}
                                className="w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm font-mono"
                            />
                        </label>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={runRequest}
                    disabled={loading}
                    className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    {loading ? "…" : "Попробовать →"}
                </button>
                <p className="text-xs text-muted-foreground">
                    Этот запрос идёт через отдельный демо-эндпоинт без API-ключа и не тарифицируется — лимит собственного ключа не расходуется.
                </p>
            </div>

            {result && (
                <div className="border rounded-xl bg-background p-6 shadow-sm border-border/60 space-y-2">
                    <div className="flex items-center gap-3 text-xs">
                        <span className={`font-mono font-bold ${result.ok ? "text-green-600" : "text-red-600"}`}>
                            {result.status || "ERR"}
                        </span>
                        {result.rateLimitRemaining !== null && (
                            <span className="text-muted-foreground">лимит категории: осталось {result.rateLimitRemaining}</span>
                        )}
                    </div>
                    <pre className="rounded-lg bg-muted/60 border border-border/60 p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
                        <code>{result.body}</code>
                    </pre>
                </div>
            )}

            <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Эквивалент для реального API</p>
                <pre className="rounded-lg bg-muted/60 border border-border/60 p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                    <code>{buildCurl(endpoint, values)}</code>
                </pre>
            </div>
        </div>
    )
}
