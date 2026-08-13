"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function PlatformAdminNav() {
  const pathname = usePathname()

  const isLibrary = pathname.startsWith("/admin/platform/library")
  const isMedia = pathname.startsWith("/admin/platform/media")
  const isUsers = pathname.startsWith("/admin/platform/users")
  const isAuditLog = pathname.startsWith("/admin/platform/audit-log")
  const isApiKeys = pathname.startsWith("/admin/platform/api-keys")

  const linkClass = (active: boolean) =>
    `inline-flex items-center h-full border-b-2 transition-colors hover:text-foreground/80 ${
      active
        ? "border-primary text-foreground font-semibold"
        : "border-transparent text-muted-foreground"
    }`

  return (
    <div className="relative border-b bg-muted/40">
      <div className="container mx-auto flex h-12 items-center px-4">
        <nav className="flex h-full space-x-6 text-sm font-medium">
          <Link href="/admin/dashboard" className={linkClass(false)}>
            Дашборд
          </Link>
          <Link href="/admin/platform/library" className={linkClass(isLibrary)}>
            Библиотека
          </Link>
          <Link href="/admin/platform/media" className={linkClass(isMedia)}>
            Медиатека
          </Link>
          <Link href="/admin/platform/users" className={linkClass(isUsers)}>
            Пользователи
          </Link>
          <Link href="/admin/platform/audit-log" className={linkClass(isAuditLog)}>
            Аудит
          </Link>
          <Link href="/admin/platform/api-keys" className={linkClass(isApiKeys)}>
            API-ключи
          </Link>
        </nav>
      </div>
    </div>
  )
}