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

    const closeAll = () => {
        setIsOpen(false)
        setToolsOpen(false)
        setUserMenuOpen(false)
    }

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

            <div className={`mobile-overlay ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(false)} />

            <ul className={`header-nav ${isOpen ? 'open' : ''}`}>

                <li><Link href="/lexicon" className="nav-link" onClick={closeAll}>{t("lexicon")}</Link></li>
                <li><Link href="/translate" className="nav-link" onClick={closeAll}>{t("translate")}</Link></li>
                <li><Link href="/library" className="nav-link" onClick={closeAll}>{t("library")}</Link></li>
                <li className="nav-item-submenu">
                    <button
                        className="nav-link submenu-toggle"
                        onClick={() => setToolsOpen(!toolsOpen)}
                    >
                        {t("tools")}
                        <span className="submenu-arrow">{toolsOpen ? '▲' : '▼'}</span>
                    </button>
                    <ul className={`submenu ${toolsOpen ? 'open' : ''}`}>
                        <li>
                            <Link href="/transliteration" className="nav-link" onClick={closeAll}>
                                {t("transliterator")}
                            </Link>
                        </li>
                    </ul>
                </li>

                <li className="nav-item-submenu"><LanguageSwitcher /></li>
                {user ? (
                    <li className="nav-item-submenu">
                        <button
                            className="nav-link submenu-toggle"
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
                        <ul className={`submenu ${userMenuOpen ? 'open' : ''}`}>
                            <li>
                                <Link href="/profile" className="nav-link" onClick={closeAll}>
                                    Profile
                                </Link>
                            </li>
                            <li>
                                <Link href="/settings" className="nav-link" onClick={closeAll}>
                                    {t("settings")}
                                </Link>
                            </li>
                            {["ADMIN", "MODERATOR"].includes(user?.role || "") && (
                                <li>
                                    <Link href="/admin" className="nav-link" onClick={closeAll}>
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
                        <Link href="/login" className="nav-link" onClick={closeAll}>
                            {t("login")}
                        </Link>
                    </li>
                )}
            </ul>
        </nav>
    )
}