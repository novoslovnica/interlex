import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { type Prisma, Role } from "../../../../prisma/generated/auth/client";
import { Feature, FEATURE_CATEGORIES, TRANSLATION_LANGUAGES } from "@/config/features"
import { revalidatePath } from "next/cache"
import { UsersManagementClient } from "./users-client"
import { ModeratorCandidates, type ModeratorCandidateView } from "./moderator-candidates"
import { init } from "@/lib/sqlite"
import { fetchModeratorCandidates } from "@/lib/community/publicStats"
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Пользователи",
  description: "Управление пользователями и правами доступа в панели администратора межславянского лексикона.",
};

const userWithPermissionsQuery = {
    include: {
        permissions: {
            select: {
                featureKey: true,
            },
        },
    },
}

export type UserWithPermissions = Prisma.UserGetPayload<{
    include: typeof userWithPermissionsQuery.include
}>

export default async function AdminUsersPage() {
    const session = await auth()

    if (!session || session.user.role !== "ADMIN") {
        redirect("/unauthorized")
    }

    const users = (await dbAuth.user.findMany({
        include: userWithPermissionsQuery.include,
        orderBy: { email: "asc" },
    })) as UserWithPermissions[]

    // Кандидаты из interlex.db (статистика ответов), пользователи - из auth.db: две фазы, без join.
    const db = await init()
    let rawCandidates
    try {
        rawCandidates = fetchModeratorCandidates(db)
    } finally {
        db.close()
    }
    const userById = new Map(users.map((u) => [u.id, u]))
    const candidates: ModeratorCandidateView[] = rawCandidates.flatMap((c) => {
        const user = userById.get(c.userId)
        if (!user || user.role === Role.ADMIN) return []
        const hasLanguage = user.permissions.some((p) => p.featureKey === `translate_${c.language}`)
        return [{
            ...c,
            label: user.email || user.name || user.id,
            alreadyModerator: user.role === Role.MODERATOR && hasLanguage,
        }]
    })

    async function promoteToModerator(userId: string, language: string) {
        "use server"
        const serverSession = await auth()
        if (!serverSession || serverSession.user.role !== "ADMIN") throw new Error("Forbidden")
        const actorUserId = serverSession.user.id
        if (!actorUserId) throw new Error("Forbidden")
        if (!TRANSLATION_LANGUAGES.some((entry) => entry.code === language)) throw new Error("Invalid language")

        const target = await dbAuth.user.findUnique({ where: { id: userId }, select: { role: true } })
        if (!target || target.role === Role.ADMIN) throw new Error("Not applicable")
        const features = [`translate_${language}`, Feature.CommunityReview]
        await dbAuth.$transaction([
            ...(target.role !== Role.MODERATOR ? [
                dbAuth.user.update({ where: { id: userId }, data: { role: Role.MODERATOR } }),
                dbAuth.roleAudit.create({ data: { actorUserId, targetUserId: userId, action: "role_change", oldValue: target.role, newValue: Role.MODERATOR } }),
            ] : []),
            ...features.flatMap((featureKey) => [
                dbAuth.featurePermission.upsert({ where: { userId_featureKey: { userId, featureKey } }, create: { userId, featureKey }, update: {} }),
                dbAuth.roleAudit.create({ data: { actorUserId, targetUserId: userId, action: "permission_grant", newValue: featureKey } }),
            ]),
        ])
        revalidatePath("/admin/platform/users")
    }

    async function updateUserRole(userId: string, newRole: Role) {
        "use server"
        const serverSession = await auth()
        if (!serverSession || serverSession.user.role !== "ADMIN") throw new Error("Forbidden")

        const actorUserId = serverSession.user.id
        if (!actorUserId) throw new Error("Forbidden")
        const before = await dbAuth.user.findUnique({ where: { id: userId }, select: { role: true } })
        if (!before || before.role === newRole) return

        await dbAuth.$transaction([
            dbAuth.user.update({
                where: { id: userId },
                data: { role: newRole },
            }),
            ...(newRole !== Role.MODERATOR ? [
                dbAuth.featurePermission.deleteMany({ where: { userId } })
            ] : []),
            dbAuth.roleAudit.create({
                data: { actorUserId, targetUserId: userId, action: "role_change", oldValue: before.role, newValue: newRole },
            }),
        ])
    }

    async function toggleFeaturePermission(userId: string, featureKey: Feature, hasAccess: boolean) {
        "use server"
        const serverSession = await auth()
        if (!serverSession || serverSession.user.role !== "ADMIN") throw new Error("Forbidden")

        const actorUserId = serverSession.user.id
        if (!actorUserId) throw new Error("Forbidden")

        if (hasAccess) {
            await dbAuth.$transaction([
                dbAuth.featurePermission.upsert({
                    where: { userId_featureKey: { userId, featureKey } },
                    create: { userId, featureKey },
                    update: {},
                }),
                dbAuth.roleAudit.create({
                    data: { actorUserId, targetUserId: userId, action: "permission_grant", newValue: featureKey },
                }),
            ])
        } else {
            await dbAuth.$transaction([
                dbAuth.featurePermission.deleteMany({
                    where: { userId, featureKey },
                }),
                dbAuth.roleAudit.create({
                    data: { actorUserId, targetUserId: userId, action: "permission_revoke", oldValue: featureKey },
                }),
            ])
        }
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-4 md:px-6 pb-2 shrink-0">
                <h1 className="text-2xl font-bold">Управление правами</h1>
                <p className="text-muted-foreground text-sm">
                    Выберите пользователя из списка слева, чтобы настроить его роль и индивидуальные фичи.
                </p>
            </div>

            <ModeratorCandidates candidates={candidates} onPromote={promoteToModerator} />

            <div className="flex-1 min-h-0 overflow-hidden">
                <UsersManagementClient
                    initialUsers={users}
                    featureCategories={FEATURE_CATEGORIES}
                    onTogglePermission={toggleFeaturePermission}
                    onUpdateRole={updateUserRole}
                />
            </div>
        </div>
    )
}