import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { type Prisma, Role } from "../../../prisma/generated/auth/client";
import { Feature, FEATURE_CATEGORIES } from "@/config/features"
import { UsersManagementClient } from "./users-client"
import AdminNav from "@/components/AdminNav";
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

    // Action 1: Изменение роли
    async function updateUserRole(userId: string, newRole: Role) {
        "use server"
        const serverSession = await auth()
        if (!serverSession || serverSession.user.role !== "ADMIN") throw new Error("Forbidden")

        await dbAuth.$transaction([
            // Обновляем роль
            dbAuth.user.update({
                where: { id: userId },
                data: { role: newRole },
            }),
            // Если это не модератор — превентивно чистим фичи из БД
            ...(newRole !== Role.MODERATOR ? [
                dbAuth.featurePermission.deleteMany({ where: { userId } })
            ] : [])
        ])
    }

    // Action 2: Переключение фичи
    async function toggleFeaturePermission(userId: string, featureKey: Feature, hasAccess: boolean) {
        "use server"
        const serverSession = await auth()
        if (!serverSession || serverSession.user.role !== "ADMIN") throw new Error("Forbidden")

        if (hasAccess) {
            await dbAuth.featurePermission.upsert({
                where: { userId_featureKey: { userId, featureKey } },
                create: { userId, featureKey },
                update: {},
            })
        } else {
            await dbAuth.featurePermission.deleteMany({
                where: { userId, featureKey },
            })
        }
    }

    return (
        <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
            <div className="flex flex-col h-full overflow-hidden">
                <AdminNav userRole={session.user.role} />
                <div className="px-4 md:px-6 pb-2 shrink-0">
                    <h1 className="text-2xl font-bold">Управление правами</h1>
                    <p className="text-muted-foreground text-sm">
                        Выберите пользователя из списка слева, чтобы настроить его роль и индивидуальные фичи.
                    </p>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden">
                    <UsersManagementClient
                        initialUsers={users}
                        featureCategories={FEATURE_CATEGORIES}
                        onTogglePermission={toggleFeaturePermission}
                        onUpdateRole={updateUserRole}
                    />
                </div>
            </div>
        </div>
    )
}
