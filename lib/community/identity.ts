import { prismaAuth } from "@/lib/prisma"

// Единственная точка, через которую имя участника попадает в публичный
// вывод (профиль, рейтинг, история правок, обсуждения). User.name и
// User.email здесь не читаются вообще: email Telegram-пользователя
// (`<username>@telegram.user`) раскрывает его ник, а имя из OAuth человек
// публиковать не соглашался. Нет ника - null, вызывающий показывает
// "Аноним".
//
// userId приходит из interlex.db (translation_votes.userId,
// audit_logs.userId и т.п.) - это вторая фаза двухфазной выборки, базы в
// одном запросе не соединяются.
export async function resolvePublicNames(userIds: Iterable<string | null | undefined>): Promise<Map<string, string>> {
    const ids = [...new Set([...userIds].filter((id): id is string => Boolean(id)))]
    if (ids.length === 0) return new Map()

    const profiles = await prismaAuth.userProfile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, handle: true },
    })
    return new Map(profiles.map((profile) => [profile.userId, profile.handle]))
}
