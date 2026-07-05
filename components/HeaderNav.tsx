'use client'

import Link from "next/link"
import { signIn, signOut } from "next-auth/react"
import {LanguageSwitcher} from "@/components/LanguageSwitcher";
import {useState} from "react";

interface HeaderNavProps {
    session: any
}

export default function HeaderNav({ session }: HeaderNavProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [toolsOpen, setToolsOpen] = useState(false)

    const user = session?.user

    return (
        <nav className="header-nav-container">
            <button
                className={`hamburger ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Переключить меню"
            >
                <span></span>
                <span></span>
                <span></span>
            </button>

            <ul className={`header-nav ${isOpen ? 'open' : ''}`}>

                {["ADMIN", "MODERATOR"].includes(user?.role || "") && (
                    <li><Link href="/admin" className="nav-link" onClick={() => setIsOpen(false)}>Админка</Link></li>
                )}
                <li><Link href="/lexicon" className="nav-link" onClick={() => setIsOpen(false)}>Лексикон</Link></li>
                <li><Link href="/proto" className="nav-link" onClick={() => setIsOpen(false)}>Праслав.</Link></li>
                <li><Link href="/translate" className="nav-link" onClick={() => setIsOpen(false)}>Перевод</Link></li>
                <li><Link href="/library" className="nav-link" onClick={() => setIsOpen(false)}>Библиотека</Link></li>
                <li><Link href="/textbook/ru" className="nav-link" onClick={() => setIsOpen(false)}>Учебник</Link></li>
                <li className="nav-item-submenu">
                    <button
                        className={`nav-link submenu-toggle ${toolsOpen ? 'active' : ''}`}
                        style={{
                            fontSize: '15px',
                            color: 'rgb(203, 213, 225)',
                        }}
                        onClick={() => setToolsOpen(!toolsOpen)}
                    >
                        Утилиты
                        <span className="submenu-arrow">{toolsOpen ? '▲' : '▼'}</span>
                    </button>
                    <ul className={`submenu ${toolsOpen ? 'open' : ''}`}>
                        <li>
                            <Link href="/transliteration" className="nav-link" onClick={() => { setIsOpen(false); setToolsOpen(false) }}>
                                Транслитератор
                            </Link>
                        </li>
                    </ul>
                </li>
                <li><Link href="/about" className="nav-link" onClick={() => setIsOpen(false)}>О программе</Link></li>

                <LanguageSwitcher />
                {user ? (
                    <>
                        <li>
                            <Link
                                href="/settings"
                                className="nav-link flex items-center gap-2 hover:opacity-80 transition-opacity"
                                onClick={() => setIsOpen(false)}
                            >
                                {user.image && (
                                    <img
                                        src={user.image}
                                        alt={user.name || "Аватар"}
                                        className="w-5 h-5 rounded-full border border-gray-300 inline-block align-middle"
                                    />
                                )}
                                <span className="text-sm font-medium">{user.name}</span>
                            </Link>
                        </li>
                        <li>
                            <button
                                onClick={() => signOut({ callbackUrl: "/" })}
                                className="nav-link border-none bg-transparent cursor-pointer"
                                style={{ font: 'inherit', color: 'inherit' }}
                            >
                                Выйти
                            </button>
                        </li>
                    </>
                ) : (
                    <li>
                        <button
                            onClick={() => signIn("yandex", { callbackUrl: "/" })}
                            className="nav-link border-none bg-transparent cursor-pointer"
                            style={{ font: 'inherit', color: 'inherit' }}
                        >
                            Войти
                        </button>
                    </li>
                )}
            </ul>
        </nav>
    )
}
