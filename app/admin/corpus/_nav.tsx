"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function CorpusAdminNav() {
  const pathname = usePathname()

  const isBuilder = pathname.startsWith("/admin/corpus/builder")
  const isDocuments = pathname.startsWith("/admin/corpus/documents")
  const isImport = pathname.startsWith("/admin/corpus/import")

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
          <Link href="/admin/corpus/builder" className={linkClass(isBuilder)}>
            Конструктор
          </Link>
          <Link href="/admin/corpus/documents" className={linkClass(isDocuments)}>
            Документы
          </Link>
          <Link href="/admin/corpus/import" className={linkClass(isImport)}>
            Импорт
          </Link>
        </nav>
      </div>
    </div>
  )
}