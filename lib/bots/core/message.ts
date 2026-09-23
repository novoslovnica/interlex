// Ответ бота в нейтральном виде и два рендерера: Telegram (parse_mode HTML) и
// Discord (embed). Команды собирают BotMessage (compose.ts), платформа только
// рисует.

export interface BotMessage {
    title: string
    subtitle?: string
    lines: string[]
    /** Таблица форм: первая строка - заголовок. Рисуется моноширинно. */
    table?: string[][]
    link?: { label: string; url: string }
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function formatTable(rows: string[][]): string {
    const widths: number[] = []
    for (const row of rows) row.forEach((cell, i) => { widths[i] = Math.max(widths[i] ?? 0, [...cell].length) })
    return rows.map((row) => row.map((cell, i) => cell + " ".repeat(widths[i] - [...cell].length)).join("  ").trimEnd()).join("\n")
}

export function toTelegramHtml(msg: BotMessage): string {
    const parts: string[] = []
    if (msg.title) parts.push(`<b>${escapeHtml(msg.title)}</b>${msg.subtitle ? ` <i>${escapeHtml(msg.subtitle)}</i>` : ""}`)
    if (msg.lines.length) parts.push(msg.lines.map(escapeHtml).join("\n"))
    if (msg.table?.length) parts.push(`<pre>${escapeHtml(formatTable(msg.table))}</pre>`)
    if (msg.link) parts.push(`<a href="${escapeHtml(msg.link.url)}">${escapeHtml(msg.link.label)}</a>`)
    // Лимит Telegram - 4096 символов на сообщение.
    const html = parts.join("\n\n")
    return html.length > 4000 ? html.slice(0, 3990) + "…" : html
}

export interface DiscordEmbed {
    title: string
    url?: string
    description: string
    color: number
}

export function toDiscordEmbed(msg: BotMessage): DiscordEmbed {
    const parts: string[] = []
    if (msg.subtitle) parts.push(`*${msg.subtitle}*`)
    if (msg.lines.length) parts.push(msg.lines.join("\n"))
    if (msg.table?.length) parts.push("```\n" + formatTable(msg.table) + "\n```")
    if (msg.link) parts.push(`[${msg.link.label}](${msg.link.url})`)
    const description = parts.join("\n\n")
    return {
        title: (msg.title || "Interslavic Lexicon").slice(0, 256),
        ...(msg.link ? { url: msg.link.url } : {}),
        // Лимит описания embed - 4096.
        description: description.length > 4000 ? description.slice(0, 3990) + "…" : description,
        color: 0x3b5bdb,
    }
}
