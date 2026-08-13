import Link from "next/link"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PUBLIC_API_RATE_LIMITS } from "@/lib/publicApi/rateLimit"
import { PUBLIC_API_DEFAULT_LIMIT, PUBLIC_API_MAX_LIMIT } from "@/lib/publicApi/words"

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("apiDocs")
    return {
        title: t("title"),
        description: t("description"),
    }
}

function CodeBlock({ children }: { children: string }) {
    return (
        <pre className="rounded-lg bg-muted/60 border border-border/60 p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
            <code>{children}</code>
        </pre>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="border rounded-xl bg-background p-6 shadow-sm border-border/60 space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{title}</h2>
            <div className="space-y-3 text-sm">{children}</div>
        </section>
    )
}

export default async function ApiDocsPage() {
    const t = await getTranslations("apiDocs")

    return (
        <div className="h-full overflow-y-auto mx-auto max-w-3xl space-y-6 px-4 md:px-6 py-10 no-scrollbar">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                <p className="text-muted-foreground text-sm mt-1">{t("intro")}</p>
            </div>

            <Section title={t("gettingStarted.title")}>
                <p className="text-muted-foreground">{t("gettingStarted.body")}</p>
                <Link href="/settings/api-keys" className="text-blue-600 font-medium hover:underline">
                    {t("gettingStarted.linkText")} →
                </Link>
            </Section>

            <Section title={t("auth.title")}>
                <p className="text-muted-foreground">{t("auth.body")}</p>
                <CodeBlock>{`Authorization: Bearer islx_your_key_here`}</CodeBlock>
            </Section>

            <Section title={t("rateLimits.title")}>
                <p className="text-muted-foreground">
                    {t("rateLimits.body", { words: PUBLIC_API_RATE_LIMITS.words, corpus: PUBLIC_API_RATE_LIMITS.corpus, library: PUBLIC_API_RATE_LIMITS.library })}
                </p>
                <p className="text-muted-foreground">{t("rateLimits.headers")}</p>
            </Section>

            <Section title={t("responseFormat.title")}>
                <p className="text-muted-foreground">{t("responseFormat.listBody")}</p>
                <CodeBlock>{`{ "data": [ ... ], "pagination": { "total": 123, "limit": ${PUBLIC_API_DEFAULT_LIMIT}, "offset": 0 } }`}</CodeBlock>
                <p className="text-muted-foreground">{t("responseFormat.errorBody")}</p>
                <CodeBlock>{`{ "error": { "code": "not_found", "message": "..." } }`}</CodeBlock>
            </Section>

            <Section title={t("endpoints.title")}>
                <div className="space-y-4">
                    <div>
                        <p className="font-mono text-xs font-bold">GET /api/public/v1/words</p>
                        <p className="text-muted-foreground text-xs mt-1">
                            {t("endpoints.wordsList", { defaultLimit: PUBLIC_API_DEFAULT_LIMIT, maxLimit: PUBLIC_API_MAX_LIMIT })}
                        </p>
                        <CodeBlock>{`curl -H "Authorization: Bearer islx_..." \\\n  "https://interslavic-lexicon.com/api/public/v1/words?search=voda&limit=10"`}</CodeBlock>
                    </div>
                    <div>
                        <p className="font-mono text-xs font-bold">GET /api/public/v1/words/:slug</p>
                        <p className="text-muted-foreground text-xs mt-1">{t("endpoints.wordsDetail")}</p>
                        <CodeBlock>{`curl -H "Authorization: Bearer islx_..." \\\n  "https://interslavic-lexicon.com/api/public/v1/words/voda-NOUN"`}</CodeBlock>
                    </div>
                    <div>
                        <p className="font-mono text-xs font-bold">GET /api/public/v1/proto</p>
                        <p className="text-muted-foreground text-xs mt-1">{t("endpoints.protoList")}</p>
                        <CodeBlock>{`curl -H "Authorization: Bearer islx_..." \\\n  "https://interslavic-lexicon.com/api/public/v1/proto?search=voda"`}</CodeBlock>
                    </div>
                    <div>
                        <p className="font-mono text-xs font-bold">GET /api/public/v1/proto/:id</p>
                        <p className="text-muted-foreground text-xs mt-1">{t("endpoints.protoDetail")}</p>
                        <CodeBlock>{`curl -H "Authorization: Bearer islx_..." \\\n  "https://interslavic-lexicon.com/api/public/v1/proto/123"`}</CodeBlock>
                    </div>
                </div>
            </Section>
        </div>
    )
}
