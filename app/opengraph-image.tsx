// Дефолтная OG-картинка сайта — для всех страниц без своей (app/opengraph-image.tsx
// применяется по сегментам вниз по дереву).
import { ImageResponse } from "next/og"
import { loadOgFonts } from "@/lib/seo/ogFonts"
import { OgCardShell, OG_ACCENT, OG_MUTED, OG_TEXT } from "@/lib/seo/wordOgCard"

export const runtime = "nodejs"
export const alt = "Interslavic Lexicon — Межславянский лексикон"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
    const fonts = await loadOgFonts()
    // Без кириллического шрифта название показываем только латиницей —
    // satori рисует пропуски вместо отсутствующих глифов.
    const showCyrillic = fonts.length > 0
    return new ImageResponse(
        (
            <OgCardShell>
                <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                    <div style={{ fontSize: 92, fontWeight: 700, color: OG_TEXT, lineHeight: 1.1 }}>
                        Interslavic Lexicon
                    </div>
                    {showCyrillic ? (
                        <div style={{ fontSize: 56, color: "#cbd5e1" }}>Межславянский лексикон</div>
                    ) : null}
                    <div style={{ fontSize: 34, color: OG_MUTED, maxWidth: 900 }}>
                        Medžuslovjansky slovnik — словарь, грамматика, корпус и переводчик междуславянского языка.
                    </div>
                    <div
                        style={{
                            marginTop: 12,
                            alignSelf: "flex-start",
                            fontSize: 28,
                            fontWeight: 700,
                            color: "#ffffff",
                            background: OG_ACCENT,
                            borderRadius: 14,
                            padding: "10px 24px",
                        }}
                    >
                        interslavic-lexicon.com
                    </div>
                </div>
            </OgCardShell>
        ),
        { ...size, fonts },
    )
}
