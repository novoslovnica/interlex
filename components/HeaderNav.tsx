'use client'

import Link from "next/link"
import { signIn, signOut } from "next-auth/react"
import {LanguageSwitcher} from "@/components/LanguageSwitcher";
import {useState} from "react";

interface HeaderNavProps {
    session: any // Передаем сессию с сервера
}

export default function HeaderNav({ session }: HeaderNavProps) {
    const [isOpen, setIsOpen] = useState(false)

    const user = session?.user

    return (
        <nav className="header-nav-container">
            {/* Кнопка Гамбургер (видима только на мобильных) */}
            <button
                className={`hamburger ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Переключить меню"
            >
                <span></span>
                <span></span>
                <span></span>
            </button>

            {/* Меню навигации */}
            <ul className={`header-nav ${isOpen ? 'open' : ''}`}>

                {user && (
                    <li><Link href="/admin" className="nav-link">Админка</Link></li>
                )}
                <li><Link href="/lexicon" className="nav-link">Лексикон</Link></li>
                <li><Link href="/translate" className="nav-link">Перевод</Link></li>
                <li><Link href="/library" className="nav-link">Библиотека</Link></li>
                <li><Link href="/textbook/ru" className="nav-link">Учебник</Link></li>
                <li><Link href="/about" className="nav-link">О программе</Link></li>

                <LanguageSwitcher />
                {/* Динамическая часть: инфо о юзере и кнопки */}
                {user ? (
                    <>
                        {/* Сделали блок пользователя кликабельной ссылкой в настройки */}
                        <li>
                            <Link
                                href="/settings"
                                className="nav-link flex items-center gap-2 hover:opacity-80 transition-opacity"
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
                            onClick={() => signIn("yandex", { callbackUrl: "/admin" })}
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
