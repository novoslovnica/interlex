import Credentials from "next-auth/providers/credentials"
import type { NextAuthConfig } from "next-auth"
import crypto from "crypto"
import Yandex from "@auth/core/providers/yandex";

// Функция валидации данных от Telegram
function verifyTelegramAuth(data: Record<string, any>, botToken: string): boolean {
    const { hash, ...checkData } = data;
    if (!hash) return false;

    // Сортируем ключи в алфавитном порядке и собираем строку в формате key=value\n
    const dataCheckString = Object.keys(checkData)
        .sort()
        .map((key) => `${key}=${checkData[key]}`)
        .join("\n");

    // Создаем секретный ключ на основе токена бота
    const secretKey = crypto.createHash("sha256").update(botToken).digest();

    // Вычисляем HMAC-SHA256 хэш полученной строки
    const hmac = crypto
        .createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

    // Хэш должен строго совпадать с тем, что прислал Telegram
    return hmac === hash;
}

export default {
    providers: [
        Credentials({
            id: "telegram",
            name: "Telegram",
            credentials: {
                tg_data: { label: "Telegram Data JSON", type: "text" },
            },
            async authorize(credentials) {
                if (!credentials?.tg_data) return null;

                try {
                    const tgUser = JSON.parse(credentials.tg_data as string);
                    const botToken = process.env.TELEGRAM_BOT_TOKEN!;

                    // 1. Проверяем подпись Telegram
                    const isValid = verifyTelegramAuth(tgUser, botToken);
                    if (!isValid) {
                        console.error("Telegram auth validation failed: Invalid hash");
                        return null;
                    }

                    // 2. Проверяем актуальность данных (опционально, защита от старых запросов — 24 часа)
                    const now = Math.floor(Date.now() / 1000);
                    if (now - Number(tgUser.auth_date) > 86400) {
                        console.error("Telegram auth validation failed: Outdated auth date");
                        return null;
                    }

                    // Возвращаем объект пользователя для сессии Auth.js
                    return {
                        id: String(tgUser.id),
                        name: tgUser.first_name + (tgUser.last_name ? ` ${tgUser.last_name}` : ""),
                        image: tgUser.photo_url || null,
                        email: tgUser.username ? `${tgUser.username}@telegram.user` : null, // У TG нет email, создаем псевдо-email
                    };
                } catch (error) {
                    console.error("Error in Telegram authorization:", error);
                    return null;
                }
            },
        }),
        Yandex({
            clientId: process.env.AUTH_YANDEX_ID,
            clientSecret: process.env.AUTH_YANDEX_SECRET,
        }),
    ],
} satisfies NextAuthConfig
