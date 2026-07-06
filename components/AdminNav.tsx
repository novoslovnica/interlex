"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
    { href: "/admin", label: "Переводы", roles: ["ADMIN", "MODERATOR"] },
    { href: "/admin/synonyms", label: "Синонимы", roles: ["ADMIN", "MODERATOR"] },
    { href: "/admin/antonyms", label: "Антонимы", roles: ["ADMIN", "MODERATOR"] },
    { href: "/admin/candidates", label: "Кандидаты", roles: ["ADMIN", "MODERATOR"] },
    { href: "/admin/roots", label: "Корни", roles: ["ADMIN", "MODERATOR"] },
    { href: "/admin/deduplication", label: "Дедупликация", roles: ["ADMIN"] },
    { href: "/admin/users", label: "Пользователи", roles: ["ADMIN"] },
]

interface AdminNavProps {
    userRole: string
}

export default function AdminNav({ userRole }: AdminNavProps) {
    const pathname = usePathname()

    return (
        // Добавляем relative, чтобы линия контейнера ложилась под активный трек
<div className="relative border-b bg-muted/40 overflow-x-auto">
            <div className="container mx-auto flex h-12 items-center px-4">
                <nav className="flex h-full space-x-6 text-sm font-medium whitespace-nowrap">
                    {navItems.map((item) => {
                        // Раскомментируйте, когда будете готовы включить проверку ролей:
                        // if (!item.roles.includes(userRole)) return null

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
