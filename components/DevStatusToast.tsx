'use client';

import { useState, useEffect } from 'react';

export default function DevStatusToast() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Проверяем, не скрывал ли пользователь уведомление ранее
        const isDismissed = localStorage.getItem('interslavic_dev_toast_dismissed');
        if (!isDismissed) {
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('interslavic_dev_toast_dismissed', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm animate-fade-in-up rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
                {/* Иконка шестеренки / разработки */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                    <svg className="h-5 w-5 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>

                {/* Текст сообщения */}
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Сайт в активной разработкe
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        Сайт находится в активной разработке. Часть функций межславянского лексикона может быть временно недоступна.
                    </p>
                    <div className="mt-2 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                        Interslavic Lexicon • 2026 ©
                    </div>
                </div>

                {/* Кнопка закрытия */}
                <button
                    onClick={handleDismiss}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    aria-label="Close"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
