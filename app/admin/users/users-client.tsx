"use client"

import { useState, useTransition } from "react"
import { Feature } from "@/config/features"
import {Role} from "@/prisma/generated/auth/enums";
import { type UserWithPermissions } from "./page"

interface UsersManagementClientProps {
    initialUsers: UserWithPermissions[]
    featureCategories: Record<string, Array<{ key: Feature; label: string; description: string }>>
    onTogglePermission: (userId: string, featureKey: Feature, hasAccess: boolean) => Promise<void>
    onUpdateRole: (userId: string, newRole: Role) => Promise<void>
}

export function UsersManagementClient({
                                          initialUsers,
                                          featureCategories,
                                          onTogglePermission,
                                          onUpdateRole,
                                      }: UsersManagementClientProps) {
    const [users, setUsers] = useState<UserWithPermissions[]>(initialUsers)
    const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUsers[0]?.id || null)
    const [isPending, startTransition] = useTransition()

    const activeUser = users.find((u) => u.id === selectedUserId)

    const handleRoleChange = (userId: string, newRole: Role) => {
        setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, role: newRole, permissions: newRole !== Role.MODERATOR ? [] : u.permissions } : u))
        )
        startTransition(async () => {
            try { await onUpdateRole(userId, newRole) } catch (error) { setUsers(initialUsers) }
        })
    }

    const handleCheckboxChange = (userId: string, featureKey: Feature, currentChecked: boolean) => {
        const newCheckedState = !currentChecked
        setUsers((prev) =>
            prev.map((user) => {
                if (user.id !== userId) return user
                const updatedPermissions = newCheckedState
                    ? [...user.permissions, { featureKey }]
                    : user.permissions.filter((p) => p.featureKey !== featureKey)
                return { ...user, permissions: updatedPermissions }
            })
        )
        startTransition(async () => {
            try { await onTogglePermission(userId, featureKey, newCheckedState) } catch (error) { setUsers(initialUsers) }
        })
    }

    return (
        // Добавлен px-4 (или md:px-6) для внешних отступов от краев экрана
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start h-full overflow-hidden px-4 md:px-6 pb-6">

            {/* ЛЕВАЯ КОЛОНКА: Прозрачный список пользователей */}
            <div className="lg:col-span-5 bg-transparent h-full overflow-y-auto pr-2 space-y-1">
                {users.map((user) => {
                    const isCurrent = user.id === selectedUserId
                    return (
                        <div
                            key={user.id}
                            onClick={() => setSelectedUserId(user.id)}
                            className={`p-4 flex items-center justify-between cursor-pointer rounded-lg border transition-all ${
                                isCurrent
                                    ? "bg-primary/10 border-primary shadow-sm ring-1 ring-primary/20"
                                    : "bg-transparent border-transparent hover:bg-muted/50"
                            }`}
                        >
                            <div className="space-y-0.5 pr-2 overflow-hidden">
                                <div className="font-semibold text-sm text-foreground truncate">{user.name || "Без имени"}</div>
                                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                            </div>

                            <div onClick={(e) => e.stopPropagation()}>
                                <select
                                    disabled={isPending}
                                    value={user.role}
                                    onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                                    className="text-xs bg-background border rounded-md px-2 py-1.5 font-medium focus:ring-1 focus:ring-primary cursor-pointer shadow-sm"
                                >
                                    <option value={Role.USER}>USER</option>
                                    <option value={Role.MODERATOR}>MODERATOR</option>
                                    <option value={Role.ADMIN}>ADMIN</option>
                                </select>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ПРАВАЯ КОЛОНКА: Аккуратная белая панель разрешений */}
            <div className="lg:col-span-7 border rounded-xl bg-background p-6 shadow-sm h-full overflow-y-auto border-border/60">
                {activeUser ? (
                    <div className="space-y-6">
                        <div className="sticky top-0 bg-background pb-4 border-b z-10 flex flex-col space-y-1">
                            <h2 className="text-base font-bold text-foreground">Разрешения для: {activeUser.name || activeUser.email}</h2>
                            <p className="text-xs text-muted-foreground">
                                Глобальный статус: <span className="font-semibold text-foreground uppercase tracking-wider">{activeUser.role}</span>
                            </p>
                        </div>

                        <div className="space-y-6">
                            {Object.entries(featureCategories).map(([categoryName, featureList]) => (
                                <div key={categoryName} className="space-y-3">
                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider sticky top-[53px] bg-background py-1 z-10">
                                        {categoryName}
                                    </h3>
                                    {/* Зафиксировано grid-cols-1 sm:grid-cols-2 для карточек */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {featureList.map((feat) => {
                                            const isMod = activeUser.role === Role.MODERATOR
                                            const isAdmin = activeUser.role === Role.ADMIN

                                            const isChecked = isAdmin ? true : isMod ? activeUser.permissions.some((p) => p.featureKey === feat.key) : false
                                            const isDisabled = isPending || !isMod

                                            return (
                                                <label
                                                    key={feat.key}
                                                    className={`flex items-start space-x-3 p-3 border rounded-lg text-sm select-none transition-all ${
                                                        isDisabled
                                                            ? "opacity-50 bg-muted/30 border-muted/60"
                                                            : "hover:bg-muted/40 cursor-pointer bg-background border-border"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        disabled={isDisabled}
                                                        checked={isChecked}
                                                        onChange={() => handleCheckboxChange(activeUser.id, feat.key, isChecked)}
                                                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed"
                                                    />
                                                    <div className="space-y-0.5 overflow-hidden">
                                                        <span className="font-semibold text-xs block text-foreground truncate">{feat.label}</span>
                                                        <span className="text-[11px] text-muted-foreground block leading-normal">
                              {feat.description}
                            </span>
                                                    </div>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-12">
                        Пользователь не выбран
                    </div>
                )}
            </div>
        </div>
    )
}
