// Shared JSX для OG-карточек (next/og / satori). Satori поддерживает лишь
// подмножество CSS: только inline-стили, только flex-раскладка, никаких
// className и CSS-переменных — поэтому вся стилизация живёт здесь в объектах.

import type { ReactNode } from "react"

// Панславянские цвета логотипа (app/icon.svg).
const PANSLAV_BLUE = "#1B4294"
const PANSLAV_YELLOW = "#FAD131"
const PANSLAV_WHITE = "#EEEEEE"
const PANSLAV_RED = "#D32F2F"

export const OG_BG = "#1e293b" // как шапка сайта
export const OG_TEXT = "#f8fafc"
export const OG_MUTED = "#94a3b8"
export const OG_ACCENT = "#2563eb" // --primary

// Треугольник из app/icon.svg. CSS-border-треугольники satori рендерит
// некорректно (zero-size box съедает верхний/нижний), поэтому логотип идёт
// как SVG data-URI в <img> — satori поддерживает SVG в img нативно.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><polygon points="0,0 32,0 16,16" fill="${PANSLAV_BLUE}"/><polygon points="0,0 0,32 16,16" fill="${PANSLAV_YELLOW}"/><polygon points="32,0 32,32 16,16" fill="${PANSLAV_WHITE}"/><polygon points="0,32 32,32 16,16" fill="${PANSLAV_RED}"/></svg>`

export function PanSlavicTriangle({ size }: { size: number }) {
    return (
        <img
            // eslint-disable-next-line @next/next/no-img-element -- OG-картинка (satori), не страница
            src={`data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`}
            width={size}
            height={size}
        />
    )
}

// Общая обёртка: тёмный фон + футер с треугольником и доменом.
export function OgCardShell({ children }: { children: ReactNode }) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: OG_BG,
                padding: 64,
            }}
        >
            {children}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <PanSlavicTriangle size={48} />
                    <div
                        style={{
                            fontSize: 30,
                            color: OG_MUTED,
                            letterSpacing: 1,
                        }}
                    >
                        interslavic-lexicon.com
                    </div>
                </div>
                <div style={{ fontSize: 26, color: OG_ACCENT, fontWeight: 700 }}>
                    Межславянский лексикон
                </div>
            </div>
        </div>
    )
}

export interface WordOgCardData {
    value: string
    transcription: string | null
    pos: string | null
    cefrLevel: string | null
}

// Карточка слова. `cyrillic` вызывающий код обязан обнулить при отсутствии
// отсутствии кириллического шрифта: satori без нужного font-буфера рисует
// пропуски, поэтому кириллическую строку без шрифта не показываем вообще.
export function WordOgCard({ data, cyrillic }: { data: WordOgCardData | null; cyrillic: string | null }) {
    return (
        <OgCardShell>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 24,
                        flexWrap: "wrap",
                    }}
                >
                    <div style={{ fontSize: 104, fontWeight: 700, color: OG_TEXT, lineHeight: 1.1 }}>
                        {data?.value ?? "Interslavic Lexicon"}
                    </div>
                    {data?.cefrLevel ? (
                        <div
                            style={{
                                fontSize: 30,
                                fontWeight: 700,
                                color: "#ffffff",
                                background: OG_ACCENT,
                                borderRadius: 12,
                                padding: "6px 18px",
                            }}
                        >
                            {data.cefrLevel}
                        </div>
                    ) : null}
                </div>
                {cyrillic ? (
                    <div style={{ fontSize: 56, color: "#cbd5e1" }}>{cyrillic}</div>
                ) : null}
                {data?.transcription ? (
                    <div style={{ fontSize: 40, fontStyle: "italic", color: OG_MUTED }}>{data.transcription}</div>
                ) : null}
                {data?.pos ? (
                    <div
                        style={{
                            fontSize: 30,
                            color: OG_ACCENT,
                            textTransform: "uppercase",
                            letterSpacing: 4,
                        }}
                    >
                        {data.pos}
                    </div>
                ) : null}
                {!data ? (
                    <div style={{ fontSize: 40, color: "#cbd5e1" }}>
                        Межславянский лексикон · Interslavic dictionary
                    </div>
                ) : null}
            </div>
        </OgCardShell>
    )
}
