'use client'

import { useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'

// Data shape the Telegram Login Widget passes to the onauth callback:
// https://core.telegram.org/widgets/login#receiving-authorization-data
interface TelegramAuthUser {
    id: number
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
    auth_date: number
    hash: string
}

declare global {
    interface Window {
        onTelegramAuth?: (user: TelegramAuthUser) => void
    }
}

interface TelegramLoginProps {
    callbackUrl?: string
}

export default function TelegramLogin({ callbackUrl = '/' }: TelegramLoginProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

    useEffect(() => {
        if (!botUsername || !containerRef.current) return

        containerRef.current.innerHTML = ''

        window.onTelegramAuth = async (user: TelegramAuthUser) => {
            await signIn('telegram', {
                tg_data: JSON.stringify(user),
                callbackUrl,
            })
        }

        const script = document.createElement('script')
        script.src = 'https://telegram.org/js/telegram-widget.js?22'
        script.setAttribute('data-telegram-login', botUsername)
        script.setAttribute('data-size', 'large')
        script.setAttribute('data-radius', '10')
        script.setAttribute('data-request-access', 'write')
        script.setAttribute('data-onauth', 'onTelegramAuth(user)')
        script.async = true

        containerRef.current.appendChild(script)

        return () => {
            delete window.onTelegramAuth
        }
    }, [botUsername, callbackUrl])

    // The bot's Telegram @username (not the bot token) must also be
    // registered as the widget's domain via @BotFather's /setdomain -
    // otherwise the widget renders an "unauthorized domain" error.
    if (!botUsername) return null

    return <div ref={containerRef} className="flex justify-center" />
}
