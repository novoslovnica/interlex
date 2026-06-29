"use client"

import Link from "next/link"

interface AboutClientProps {
    stats: {
        words: string
        meanings: string
        roots: string
        languages: string
    }
}

export function MainClient({ stats }: AboutClientProps) {
    return (
        <div className="max-w-4xl mx-auto px-4 md:px-6 space-y-16 animate-fade-in">

            {/* СЕКЦИЯ 1: ГЛАВНЫЙ БАННЕР */}
            <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    🌍 Электронный лексикон
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                    Межславянский электронный словарь
                </h1>
                <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    Профессиональный инструмент для лингвистических исследований, перевода и изучения
                    панславянского языка. Платформа объединяет классические славянские корни и современные языковые формы.
                </p>
            </div>

            {/* СЕКЦИЯ 2: ЖИВАЯ СТАТИСТИКА (ИНФОГРАФИКА) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 border rounded-xl bg-background shadow-sm text-center space-y-1">
                    <span className="block text-2xl md:text-3xl font-bold text-blue-600">{stats.words}</span>
                    <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">Всего слов</span>
                </div>
                <div className="p-5 border rounded-xl bg-background shadow-sm text-center space-y-1">
                    <span className="block text-2xl md:text-3xl font-bold text-foreground">{stats.languages}</span>
                    <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">Языков перевода</span>
                </div>
                <div className="p-5 border rounded-xl bg-background shadow-sm text-center space-y-1">
                    <span className="block text-2xl md:text-3xl font-bold text-foreground">{stats.roots}</span>
                    <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">Уникальных корней</span>
                </div>
                <div className="p-5 border rounded-xl bg-background shadow-sm text-center space-y-1">
                    <span className="block text-2xl md:text-3xl font-bold text-foreground">{stats.meanings}</span>
                    <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">Смысловых значений</span>
                </div>
            </div>

            {/* СЕКЦИЯ 3: ОПИСАНИЕ И ОСОБЕННОСТИ ПРОГРАММЫ */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-foreground border-b pb-2">Основные возможности платформы</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <div className="flex gap-4 items-start">
                        <div className="p-2 rounded-lg bg-muted text-foreground font-bold text-sm h-9 w-9 flex items-center justify-center shrink-0">
                            Aa
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-sm">Умная орфография (Скрипты)</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Система автоматически подстраивается под локаль вашего браузера или личные настройки,
                                переключая отображение межславянских слов между кириллицей и латиницей (`isv` нотация).
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="p-2 rounded-lg bg-muted text-foreground font-bold text-sm h-9 w-9 flex items-center justify-center shrink-0">
                            🔗
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-sm">Морфемный и семантический граф</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Слова не просто хранятся списком, а связаны в глубокую сеть синонимов, антонимов
                                и корневых групп, позволяя исследовать этимологию и семантическую близость лексем.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="p-2 rounded-lg bg-muted text-foreground font-bold text-sm h-9 w-9 flex items-center justify-center shrink-0">
                            👥
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-sm">Многоуровневая модерация</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Программа поддерживает строгую ролевую модель. Администраторы могут точечно распределять
                                права по языкам для модераторов, гарантируя качество и верификацию каждого перевода.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="p-2 rounded-lg bg-muted text-foreground font-bold text-sm h-9 w-9 flex items-center justify-center shrink-0">
                            ⚡
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-sm">Высокая производительность</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Благодаря архитектуре Next.js App Router и оптимизированным индексам SQLite,
                                поиск по десяткам тысяч слов и связь композитов происходят на клиенте за доли секунды.
                            </p>
                        </div>
                    </div>

                </div>
            </div>

            {/* СЕКЦИЯ 4: ПРИЗЫВ К ДЕЙСТВИЮ / ССЫЛКИ */}
            <div className="border border-dashed rounded-2xl p-6 bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                    <h3 className="font-bold text-sm">Хотите внести вклад в развитие лексикона?</h3>
                    <p className="text-xs text-muted-foreground">
                        Зарегистрируйтесь в системе, чтобы получить доступ к базовым функциям или запросить права модератора.
                    </p>
                </div>
                <div className="flex gap-3 shrink-0">
                    <Link
                        href="/textbook"
                        className="px-4 py-2 border rounded-md text-xs font-semibold hover:bg-background bg-transparent transition-colors"
                    >
                        Читать учебник
                    </Link>
                    <Link
                        href="/"
                        className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-md hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        Перейти к поиску
                    </Link>
                </div>
            </div>

        </div>
    )
}
