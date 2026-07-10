"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Feature } from "@/config/features"

const navItems = [
    { href: "/admin", label: "Переводы", roles: ["ADMIN", "MODERATOR"], feature: Feature.DictionaryEdit },
    { href: "/admin/synonyms", label: "Синонимы", roles: ["ADMIN", "MODERATOR"], feature: Feature.SynonymsEdit },
    { href: "/admin/antonyms", label: "Антонимы", roles: ["ADMIN", "MODERATOR"], feature: Feature.AntonymsEdit },
    { href: "/admin/candidates", label: "Кандидаты", roles: ["ADMIN", "MODERATOR"], feature: Feature.CandidatesPromote },
    { href: "/admin/roots", label: "Корни", roles: ["ADMIN", "MODERATOR"], feature: Feature.RootsEdit },
    { href: "/admin/endings", label: "Окончания", roles: ["ADMIN", "MODERATOR"], feature: Feature.EndingsEdit },
    { href: "/admin/deduplication", label: "Дедупликация", roles: ["ADMIN"], feature: Feature.DeduplicationManage },
    { href: "/admin/users", label: "Пользователи", roles: ["ADMIN"], feature: undefined },
]

interface AdminNavProps {
    userRole: string
    userPermissions?: string[]
}

export default function AdminNav({ userRole, userPermissions = [] }: AdminNavProps) {
    const pathname = usePathname()

    const hasAccess = (item: typeof navItems[number]) => {
        if (!item.roles.includes(userRole)) return false
        if (userRole === "ADMIN") return true
        if (!item.feature) return false
        return userPermissions.includes(item.feature)
    }

    return (
        <div className="relative border-b bg-muted/40 overflow-x-auto">
            <div className="container mx-auto flex h-12 items-center px-4">
                <nav className="flex h-full space-x-6 text-sm font-medium whitespace-nowrap">
                    {navItems.map((item) => {
                        if (!hasAccess(item)) return null

                        const isActive = pathname === item.href

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={
                                    `inline-flex items-center h-full border-b-2 transition-colors hover:text-foreground/80 
                                    ${isActive
                                        ? "border-primary text-foreground font-semibold"
                                        : "border-transparent text-muted-foreground"}`
                                }
                            >
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>
            </div>
        </div>
    )
}