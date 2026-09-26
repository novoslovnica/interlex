// OG-картинка страницы слова (файловая конвенция Next: лежит рядом со
// страницей и подхватывается в metadata автоматически).
import { ImageResponse } from "next/og"
import { init } from "@/lib/sqlite"
import { latinToCyrillic } from "@/lib/orthography/standard"
import { loadOgFonts } from "@/lib/seo/ogFonts"
import { WordOgCard, type WordOgCardData } from "@/lib/seo/wordOgCard"

export const runtime = "nodejs"
export const alt = "Interslavic Lexicon — слово"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Лёгкий запрос только для OG — тяжёлый getItem (18 таблиц переводов) здесь
// не нужен; схема как в app/sitemap.ts.
async function fetchWordOgData(id: string): Promise<(WordOgCardData & { cyrillic: string | null }) | null> {
    const db = await init()
    try {
        const row = db
            .prepare(`SELECT value, transcription, pos, cefrLevel FROM lexemes WHERE id = ? AND isPublic = 1`)
            .get(id) as { value: string; transcription: string | null; pos: string | null; cefrLevel: string | null } | undefined
        if (!row?.value) return null

        // Кириллический стандартный аллофон: по аналогии с app/words/[id]/api.ts
        // это flavor 'NSL' (type='standard'); CORE — латиница. Если записи нет —
        // конвертируем латиницу тем же конвертером, что использует сайт.
        const cyrRow = db
            .prepare(
                `SELECT la.value FROM lexeme_allophones la
                 JOIN allophone_flavors af ON af.id = la.flavorId
                 WHERE la.lexemeId = ? AND la.type = 'standard' AND af.code = 'NSL'`,
            )
            .get(id) as { value: string } | undefined
        let cyrillic = cyrRow?.value ?? null
        if (!cyrillic) {
            const converted = latinToCyrillic(row.value)
            cyrillic = converted !== row.value ? converted : null
        }
        return { ...row, cyrillic }
    } finally {
        db.close()
    }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    // Несуществующая/скрытая лексема — дефолтная карточка без слова, не 404:
    // OG-эндпоинт должен отдавать картинку всегда.
    const data = await fetchWordOgData(id)
    const fonts = await loadOgFonts()
    // Satori без кириллического font-буфера рисует пропуски — без шрифта
    // кириллическую строку опускаем (латиница рискует тем же, но IPA-слова
    // покрываются латинским subset'ом; в полном провале сети рендер упадёт —
    // нужен исходящий доступ к fonts.gstatic.com / cdn.jsdelivr.net).
    const cyrillic = fonts.length > 0 ? (data?.cyrillic ?? null) : null
    return new ImageResponse(<WordOgCard data={data} cyrillic={cyrillic} />, { ...size, fonts })
}
