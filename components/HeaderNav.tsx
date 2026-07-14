'use client'

import Link from "next/link"
import { signOut } from "next-auth/react"
import {LanguageSwitcher} from "@/components/LanguageSwitcher";
import {useState} from "react";
import {useTranslations} from "next-intl";

interface HeaderNavProps {
    session: any
}

export default function HeaderNav({ session }: HeaderNavProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [toolsOpen, setToolsOpen] = useState(false)
    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const t = useTranslations("common.navigation")

    const user = session?.user

    return (
        <nav className="header-nav-container">
            <button
                className={`hamburger ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label={t("toggleMenu")}
            >
                <span></span>
                <span></span>
                <span></span>
            </button>

            <ul className={`header-nav ${isOpen ? 'open' : ''}`}>

                <li><Link href="/lexicon" className="nav-link" onClick={() => setIsOpen(false)}>{t("lexicon")}</Link></li>
                <li><Link href="/translate" className="nav-link" onClick={() => setIsOpen(false)}>{t("translate")}</Link></li>
                <li><Link href="/library" className="nav-link" onClick={() => setIsOpen(false)}>{t("library")}</Link></li>
                <li style={{ position: "relative" }}>
                    <button
                        className="nav-link submenu-toggle"
                        style={{
                            fontSize: '15px',
                            color: 'rgb(203, 213, 225)',
                            width: '100%',
                            textAlign: 'left',
                            border: 'none',
                            background: 'none',
                            font: 'inherit',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 16px',
                            cursor: 'pointer',
                        }}
                        onClick={() => setToolsOpen(!toolsOpen)}
                    >
                        {t("tools")}
                        <span className="submenu-arrow">{toolsOpen ? '▲' : '▼'}</span>
                    </button>
                    {toolsOpen && (
                        <ul className="submenu open" style={{ paddingLeft: 0 }}>
                            <li>
                                <Link href="/transliteration" className="nav-link" onClick={() => { setIsOpen(false); setUserMenuOpen(false); setToolsOpen(false) }}>
                                    {t("transliterator")}
                                </Link>
                            </li>
                        </ul>
                    )}
                </li>

                <LanguageSwitcher />
                {user ? (
                    <li className="nav-item-submenu" style={{ position: 'relative' }}>
                        <button
                            className="nav-link flex items-center gap-2 hover:opacity-80 transition-opacity submenu-toggle"
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                        >
                            {user.image && (
                                <img
                                    src={user.image}
                                    alt={user.name || t("avatar")}
                                    className="w-5 h-5 rounded-full border border-gray-300 inline-block align-middle"
                                />
                            )}
                            <span className="text-sm font-medium">{user.name}</span>
                            <span className="submenu-arrow">{userMenuOpen ? '▲' : '▼'}</span>
                        </button>
                        <ul className={`submenu ${userMenuOpen ? 'open' : ''}`}
                            style={{ right: 0, left: 'auto' }}
                        >
                            <li>
                                <Link href="/profile" className="nav-link" onClick={() => { setIsOpen(false); setUserMenuOpen(false) }}>
                                    Profile
                                </Link>
                            </li>
                            <li>
                                <Link href="/settings" className="nav-link" onClick={() => { setIsOpen(false); setUserMenuOpen(false) }}>
                                    {t("settings")}
                                </Link>
                            </li>
                            {["ADMIN", "MODERATOR"].includes(user?.role || "") && (
                                <li>
                                    <Link href="/admin" className="nav-link" onClick={() => { setIsOpen(false); setUserMenuOpen(false) }}>
                                        {t("admin")}
                                    </Link>
                                </li>
                            )}
                            <li>
                                <button
                                    onClick={() => signOut({ callbackUrl: "/" })}
                                    className="nav-link"
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        font: 'inherit',
                                        color: 'inherit',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 16px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t("logout")}
                                </button>
                            </li>
                        </ul>
                    </li>
                ) : (
                    <li>
                        <Link href="/login" className="nav-link" onClick={() => setIsOpen(false)}>
                            {t("login")}
                        </Link>
                    </li>
                )}
            </ul>
        </nav>
    )
}