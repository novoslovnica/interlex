import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
    './i18n/request.ts'
);

const isDev = process.env.NODE_ENV !== "production";

// Внешние источники, которые страницы действительно грузят: Google Fonts
// (layout.tsx), виджет входа Telegram (components/TelegramLogin.tsx - скрипт
// с telegram.org, окно с oauth.telegram.org), YouTube-встраивания в
// библиотеке (app/library/[slug]). 'unsafe-inline' для скриптов нужен самому
// Next (inline-бутстрап), next-themes и JSON-LD; без nonce его не убрать -
// основная защита здесь в запрете чужих источников, object/base и фреймов.
// form-action не задаётся: вход через Google/Yandex - форма на /api/auth с
// редиректом на чужой домен, а form-action распространяется на редиректы.
const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://telegram.org${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https:",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "frame-src https://oauth.telegram.org https://www.youtube.com https://www.youtube-nocookie.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
].join("; ");

const securityHeaders = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    // Без includeSubDomains: за поддомены сайта здесь никто не отвечает.
    ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]),
];

const nextConfig: NextConfig = {
    experimental: {
        serverActions: {
            // Лимит глобальный для всех server actions, включая публичные
            // (настройки, профиль). Самый большой реальный запрос - текст книги
            // в /admin/platform/library (самый длинный сейчас ~950 тыс. символов,
            // ~2 МБ в UTF-8) - 10 МБ оставляют пятикратный запас.
            bodySizeLimit: "10mb",
        },
    },
    serverExternalPackages: ["epub-gen"],
    typescript: {
        ignoreBuildErrors: true,
    },
    async headers() {
        return [{ source: "/:path*", headers: securityHeaders }];
    },
};

export default withNextIntl(nextConfig);
