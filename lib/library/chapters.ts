/**
 * Чистые преобразования текста библиотеки: признак сжатия, разбивка на главы,
 * обратная сборка. Вынесены из lib/body.ts без изменения поведения.
 *
 * Причина выноса: lib/body.ts импортирует node:zlib (gzip для хранения тела),
 * а `app/admin/platform/library/new/form.tsx` — клиентский компонент
 * ("use client") и тянет оттуда именно эти функции. Клиентская сборка не может
 * разрешить node:zlib и падает на `next build` с
 * «Module not found: Can't resolve 'zlib'». Теперь клиентский код берёт функции
 * отсюда, а zlib остаётся в lib/body.ts, куда его импортируют только серверные
 * пути. lib/body.ts реэкспортирует эти функции, поэтому остальные импорты
 * `@/lib/body` не тронуты.
 */

export function isCompressed(body: string): boolean {
    return body.startsWith("H4s")
}

export interface Chapter {
    heading: string
    content: string
}

export function splitIntoChapters(body: string): Chapter[] {
    const parts = body.split(/^## /m)
    if (parts.length <= 1) return [{ heading: "", content: body }]
    const chapters: Chapter[] = []
    if (parts[0].trim()) chapters.push({ heading: "", content: parts[0].trim() })
    for (let i = 1; i < parts.length; i++) {
        const idx = parts[i].indexOf("\n")
        if (idx === -1) {
            chapters.push({ heading: parts[i].trim(), content: "" })
        } else {
            chapters.push({ heading: parts[i].slice(0, idx).trim(), content: parts[i].slice(idx + 1).trim() })
        }
    }
    return chapters
}

export function joinChapters(chapters: Chapter[]): string {
    return chapters
        .map(ch => {
            if (ch.heading) return `## ${ch.heading}\n\n${ch.content}`
            return ch.content
        })
        .filter(Boolean)
        .join("\n\n")
}
