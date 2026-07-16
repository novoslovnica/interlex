"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Feature } from "@/config/features"
import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"

interface NavItem {
    href: string
    label: string
    roles: string[]
    feature?: string
}

interface NavGroup {
    label: string
    roles: string[]
    feature?: string
    children: NavItem[]
}

type NavEntry = NavItem | NavGroup

function isGroup(entry: NavEntry): entry is NavGroup {
    return "children" in entry
}

function getFeature(entry: NavEntry): string | undefined {
    return "feature" in entry ? (entry as NavItem).feature : undefined
}

const navItems: NavEntry[] = [
    { href: "/admin", label: "Переводы", roles: ["ADMIN", "MODERATOR"], feature: Feature.DictionaryEdit },
    { href: "/admin/translation-cards", label: "Переводы (карточки)", roles: ["ADMIN", "MODERATOR"], feature: Feature.DictionaryEdit },
    { href: "/admin/synonyms", label: "Синонимы", roles: ["ADMIN", "MODERATOR"], feature: Feature.SynonymsEdit },
    { href: "/admin/antonyms", label: "Антонимы", roles: ["ADMIN", "MODERATOR"], feature: Feature.AntonymsEdit },
    {
        label: "Отношения",
        roles: ["ADMIN", "MODERATOR"],
        feature: Feature.RelationsManage,
        children: [
            { href: "/admin/relations/hypernyms", label: "Гиперонимы", roles: ["ADMIN", "MODERATOR"], feature: Feature.HypernymsEdit },
            { href: "/admin/relations/hyponyms", label: "Гипонимы", roles: ["ADMIN", "MODERATOR"], feature: Feature.HyponymsEdit },
            { href: "/admin/relations/meronyms", label: "Меронимы", roles: ["ADMIN", "MODERATOR"], feature: Feature.MeronymsEdit },
            { href: "/admin/relations/holonyms", label: "Холонимы", roles: ["ADMIN", "MODERATOR"], feature: Feature.HolonymsEdit },
            { href: "/admin/relations/related-words", label: "Связанные", roles: ["ADMIN", "MODERATOR"], feature: Feature.RelatedWordsEdit },
            { href: "/admin/relations/causes", label: "Причины", roles: ["ADMIN", "MODERATOR"], feature: Feature.CausesEdit },
            { href: "/admin/relations/effects", label: "Следствия", roles: ["ADMIN", "MODERATOR"], feature: Feature.EffectsEdit },
            { href: "/admin/relations/premises", label: "Предпосылки", roles: ["ADMIN", "MODERATOR"], feature: Feature.PremisesEdit },
            { href: "/admin/relations/conclusions", label: "Заключения", roles: ["ADMIN", "MODERATOR"], feature: Feature.ConclusionsEdit },
        ],
    },
    { href: "/admin/candidates", label: "Кандидаты", roles: ["ADMIN", "MODERATOR"], feature: Feature.CandidatesPromote },
    { href: "/admin/roots", label: "Корни", roles: ["ADMIN", "MODERATOR"], feature: Feature.RootsEdit },
    { href: "/admin/endings", label: "Окончания", roles: ["ADMIN", "MODERATOR"], feature: Feature.EndingsEdit },
    { href: "/admin/deduplication", label: "Дедупликация", roles: ["ADMIN"], feature: Feature.DeduplicationManage },
    { href: "/admin/library", label: "Библиотека", roles: ["ADMIN", "MODERATOR"], feature: Feature.LibraryManage },
    { href: "/admin/users", label: "Пользователи", roles: ["ADMIN"], feature: undefined },
]

interface AdminNavProps {
    userRole: string
    userPermissions?: string[]
}

function hasAccess(entry: NavEntry, userRole: string, userPermissions: string[]): boolean {
    if (isGroup(entry)) {
        if (!entry.roles.includes(userRole)) return false
        if (userRole === "ADMIN") return true
        if (entry.feature && !userPermissions.includes(entry.feature)) return false
        return entry.children.some(c => hasAccess(c, userRole, userPermissions))
    }
    if (!entry.roles.includes(userRole)) return false
    if (userRole === "ADMIN") return true
    if (!entry.feature) return false
    return userPermissions.includes(entry.feature)
}

function DropdownGroup({ group, userRole, userPermissions }: { group: NavGroup; userRole: string; userPermissions: string[] }) {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const btnRef = useRef<HTMLButtonElement>(null)
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    useEffect(() => {
        if (open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect()
            setMenuStyle({
                position: "fixed",
                top: rect.bottom + 4,
                left: rect.left,
                minWidth: 180,
            })
        }
    }, [open])

    const isAnyChildActive = group.children.some(c => c.href && pathname.startsWith(c.href))

    return (
        <div className="h-full" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            <button
                ref={btnRef}
                onClick={() => setOpen(!open)}
                className={`inline-flex items-center h-full border-b-2 transition-colors hover:text-foreground/80 gap-1
                    ${isAnyChildActive || (open && group.children.some(c => c.href && pathname.startsWith(c.href)))
                        ? "border-primary text-foreground font-semibold"
                        : "border-transparent text-muted-foreground"}`}
            >
                {group.label}
                <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && createPortal(
                <div style={menuStyle} className="bg-background border rounded-lg shadow-lg py-1 z-50">
                    {group.children.map(child => {
                        if (!hasAccess(child, userRole, userPermissions)) return null
                        const isActive = pathname === child.href
                        return (
                            <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setOpen(false)}
                                className={`block px-4 py-2 text-sm transition-colors hover:bg-muted
                                    ${isActive ? "text-foreground font-semibold bg-muted/50" : "text-muted-foreground"}`}
                            >
                                {child.label}
                            </Link>
                        )
                    })}
                </div>,
                document.body
            )}
        </div>
    )
}

export default function AdminNav({ userRole, userPermissions = [] }: AdminNavProps) {
    const pathname = usePathname()

    return (
        <div className="relative border-b bg-muted/40">
            <div className="container mx-auto flex h-12 items-center px-4">
                <nav className="flex h-full space-x-6 text-sm font-medium whitespace-nowrap overflow-x-auto">
                    {navItems.map((entry) => {
                        if (!hasAccess(entry, userRole, userPermissions)) return null

                        if (isGroup(entry)) {
                            return (
                                <DropdownGroup
                                    key={entry.label}
                                    group={entry}
                                    userRole={userRole}
                                    userPermissions={userPermissions}
                                />
                            )
                        }

                        const isActive = pathname === entry.href

                        return (
                            <Link
                                key={entry.href}
                                href={entry.href}
                                className={`inline-flex items-center h-full border-b-2 transition-colors hover:text-foreground/80 
                                    ${isActive
                                        ? "border-primary text-foreground font-semibold"
                                        : "border-transparent text-muted-foreground"}`}
                            >
                                {entry.label}
                            </Link>
                        )
                    })}
                </nav>
            </div>
        </div>
    )
}