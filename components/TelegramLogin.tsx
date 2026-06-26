'use client'

import { useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'

export default function TelegramLogin() {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Очищаем контейнер перед добавлением скрипта
        if (containerRef.current) {
            containerRef.current.innerHTML = ''
        }

        // Создаем элемент скрипта виджета Telegram
        const script = document.createElement('script')
        script.src = 'https://telegram.org'
        script.setAttribute('data-telegram-login', 'ИМЯ_ВАШЕГО_БОТА_БЕЗ_СОБАЧКИ') // Замените на имя вашего бота
        script.setAttribute('data-size', 'large')
        script.setAttribute('data-radius', '10')
        script.setAttribute('data-request-access', 'write')
        script.setAttribute('data-onauth', 'onTelegramAuth(user)')
        script.async = true

        // Глобальный колбэк, который вызовет скрипт Telegram при успехе
        ;(window as any).onTelegramAuth = async (user: any) => {
            // Отправляем данные пользователя в Auth.js Credentials Provider
            await signIn('telegram', {
                tg_data: JSON.stringify(user),
                callbackUrl: '/dashboard',
            })
        }

        containerRef.current?.appendChild(script)
    }, [])

    return <div ref={containerRef} className="flex justify-center" />
}
