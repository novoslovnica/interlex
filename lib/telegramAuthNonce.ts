import { prismaAuth } from "@/lib/prisma";

const REPLAY_WINDOW_SECONDS = 86400; // matches the auth_date freshness check in auth.config.ts

/**
 * Replay protection for Telegram Credentials login. Telegram's HMAC hash is
 * unique per login event (differs by auth_date and user data), so it
 * doubles as the nonce itself - claiming it once in telegram_auth_nonces is
 * enough. Returns false if the hash was already claimed (replay).
 *
 * `INSERT OR IGNORE` is a single atomic SQLite statement, so this is safe
 * under concurrent requests carrying the same payload - unlike a
 * check-then-insert, there is no window where two requests could both see
 * "not claimed yet" and both proceed.
 */
export async function claimTelegramAuthHash(hash: string, authDate: number, now: number): Promise<boolean> {
    const claimed = await prismaAuth.$executeRaw`
        INSERT OR IGNORE INTO telegram_auth_nonces (hash, authDate)
        VALUES (${hash}, ${authDate})
    `;
    if (claimed === 0) return false;

    // Opportunistic cleanup: a payload outside the freshness window would
    // already fail the auth_date check regardless, so its hash serves no
    // further purpose once it ages out.
    await prismaAuth.$executeRaw`DELETE FROM telegram_auth_nonces WHERE authDate < ${now - REPLAY_WINDOW_SECONDS}`;

    return true;
}
