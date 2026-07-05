'use client';

import { useState } from 'react';
import Link from 'next/link';

// Note: metadata is not supported in 'use client' components.
// The title/description are provided by the layout template.

// Массив разделов учебника, сформированный на основе официального содержания
const chapters = [
    { id: 'intro', title: 'Предисловие и введение', category: 'Основы' },
    { id: 'pronunciation', title: '1. Произношение и алфавит', category: 'Грамматика' },
    { id: 'syntax', title: '2. Структура предложения, порядок слов', category: 'Грамматика' },
    { id: 'articles', title: '3. Определённый и неопределённый артикли', category: 'Грамматика' },
    { id: 'nouns', title: '4. Имя существительное. Падежи. Предлоги', category: 'Грамматика' },
    { id: 'verbs-base', title: '5. Глаголы быть и иметь', category: 'Глаголы' },
    { id: 'questions', title: '6. Вопросительные предложения. Да и нет. Отрицание', category: 'Грамматика' },
    { id: 'pronouns', title: '7. Местоимения', category: 'Грамматика' },
    { id: 'adjectives', title: '8. Имя прилагательное', category: 'Грамматика' },
    { id: 'numbers', title: '9. Имя числительное', category: 'Грамматика' },
    { id: 'verbs-present', title: '10. Настоящее время у глаголов', category: 'Глаголы' },
    { id: 'adverbs', title: '11. Наречия, идиомы', category: 'Лексика' },
    { id: 'imperative', title: '12. Повелительное наклонение глагола', category: 'Глаголы' },
    { id: 'verbs-past', title: '13. Прошедшие времена глагола', category: 'Глаголы' },
    { id: 'verbs-future', title: '14. Будущие времена глагола', category: 'Глаголы' },
    { id: 'aspects', title: '15. Аспекты глагольной системы', category: 'Глаголы' },
    { id: 'participles', title: '16. Отглагольные существительные, причастия', category: 'Глаголы' },
    { id: 'conjunctions', title: '17. Союзы, частицы и междометия', category: 'Грамматика' },
    { id: 'complex-sentences', title: '18. Сложносочинённые и сложноподчинённые предложения', category: 'Грамматика' },
    { id: 'word-formation', title: '20. Словообразование, уменьшительные слова', category: 'Лексика' },
];

export default function TextbookPage() {
    const [activeChapter, setActiveChapter] = useState('pronunciation');

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden text-sm">

            {/* САЙДБАР: НЕЗАВИСИМО СКРОЛЛИРУЕМОЕ МЕНЮ СЛЕВА */}
            <aside className="w-80 border-r bg-muted/20 flex flex-col h-full shrink-0 hidden md:flex">
                {/* Хедер сайдбара с кнопкой возврата */}
                <div className="p-4 border-b space-y-3 shrink-0">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ← На главную лексикона
                    </Link>
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-base tracking-tight">Учебник панславянского</h2>
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-xxs font-bold dark:text-blue-400">
                            v1.0
                        </span>
                    </div>
                </div>

                {/* Прокручиваемый список глав */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
                    {/* Группировка элементов по категориям */}
                    {['Основы', 'Грамматика', 'Глаголы', 'Лексика'].map((category) => (
                        <div key={category} className="space-y-1.5">
                            <h4 className="text-xxs font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">
                                {category}
                            </h4>
                            <div className="space-y-1">
                                {chapters
                                    .filter((ch) => ch.category === category)
                                    .map((chapter) => (
                                        <button
                                            key={chapter.id}
                                            onClick={() => setActiveChapter(chapter.id)}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-all text-xs font-medium block leading-snug ${
                                                activeChapter === chapter.id
                                                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/10'
                                                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {chapter.title}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* ОСНОВНАЯ ОБЛАСТЬ: НЕЗАВИСИМО СКРОЛЛИРУЕМЫЙ КОНТЕНТ ГЛАВЫ */}
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-background">

                {/* Верхняя навигационная плашка для мобильных и десктопа */}
                <header className="border-b px-6 py-4 flex items-center justify-between bg-background/50 backdrop-blur shrink-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Учебник</span>
                        <span>/</span>
                        <span className="text-foreground font-medium">
                            {chapters.find((ch) => ch.id === activeChapter)?.title.split('. ')[1] || 'Глава'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/lexicon"
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                        >
                            Словарь 🔍
                        </Link>
                    </div>
                </header>

                {/* Прокручиваемый контейнер самой статьи */}
                <div className="flex-1 overflow-y-auto px-6 md:px-12 2xl:px-24 py-8 md:py-12 no-scrollbar">
                    <article className="max-w-3xl 2xl:max-w-4xl mx-auto space-y-8 pb-16">

                        {/* Рендеринг контента в зависимости от активного ID */}
                        {activeChapter === 'pronunciation' && (
                            <>
                                <header className="space-y-3 border-b pb-6">
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Глава 1</span>
                                    <h1 className="text-3xl md:text-4xl 2xl:text-5xl font-black tracking-tight">Произношение и алфавит</h1>
                                    <p className="text-base text-muted-foreground">
                                        Базовые правила чтения, графические системы (латиница и кириллица) и фонетическая структура межславянского языка.
                                    </p>
                                </header>

                                <section className="space-y-4">
                                    <h3 className="text-lg md:text-xl font-bold">Основы графики</h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        Межславянский язык разработан сбалансированным образом, позволяя использовать как латинский алфавит (isv-латиница), так и кириллический. Системы абсолютно эквивалентны, и выбор зависит исключительно от контекста и предпочтений пользователя.
                                    </p>

                                    {/* Пример интерактивной таблицы */}
                                    <div className="border rounded-2xl overflow-hidden bg-muted/10 my-6">
                                        <table className="w-full text-left border-collapse text-xs md:text-sm">
                                            <thead>
                                            <tr className="bg-muted/50 border-b">
                                                <th className="p-3 font-semibold">Латиница</th>
                                                <th className="p-3 font-semibold">Кириллица</th>
                                                <th className="p-3 font-semibold">Произношение (МФА)</th>
                                                <th className="p-3 font-semibold">Пример</th>
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                            <tr>
                                                <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">A a</td>
                                                <td className="p-3 font-bold">А а</td>
                                                <td className="p-3 text-muted-foreground">[a]</td>
                                                <td className="p-3">общий славянский звук «а»</td>
                                            </tr>
                                            <tr>
                                                <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">Č č</td>
                                                <td className="p-3 font-bold">Ч ч</td>
                                                <td className="p-3 text-muted-foreground">[tʃ]</td>
                                                <td className="p-3">мягкое «ч», как в русском языке</td>
                                            </tr>
                                            <tr>
                                                <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">Ž ž</td>
                                                <td className="p-3 font-bold">Ж ж</td>
                                                <td className="p-3 text-muted-foreground">[ʒ]</td>
                                                <td className="p-3">«ж», как в слове «жизнь»</td>
                                            </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section className="p-5 border border-dashed rounded-2xl bg-blue-500/5 border-blue-500/20 space-y-2">
                                    <h4 className="font-bold text-sm text-blue-600 dark:text-blue-400">💡 Межславянский факт</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Благодаря математически выверенной корневой системе, зная правила произношения, носитель любого славянского языка поймет до 80% устной речи без предварительного обучения!
                                    </p>
                                </section>
                            </>
                        )}

                        {/* ЗАГЛУШКА ДЛЯ ОСТАЛЬНЫХ ГЛАВ */}
                        {activeChapter !== 'pronunciation' && (
                            <>
                                <header className="space-y-3 border-b pb-6">
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Раздел</span>
                                    <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                                        {chapters.find((ch) => ch.id === activeChapter)?.title}
                                    </h1>
                                    <p className="text-base text-muted-foreground">
                                        Материалы данного подраздела находятся в процессе синхронизации с межславянским мануалом.
                                    </p>
                                </header>

                                <section className="py-12 text-center space-y-4 border border-dashed rounded-3xl bg-muted/10">
                                    <div className="text-4xl">📖</div>
                                    <div className="space-y-1 max-w-sm mx-auto">
                                        <h3 className="font-bold text-sm">Контент загружается...</h3>
                                        <p className="text-xs text-muted-foreground">
                                            Здесь будет развернута полная грамматическая справка, примеры склонений, парадигмы и аудиоматериалы для самопроверки.
                                        </p>
                                    </div>
                                </section>
                            </>
                        )}

                        {/* ПАГИНАЦИЯ ВНИЗУ СТАТЬИ */}
                        <footer className="pt-8 border-t flex items-center justify-between gap-4">
                            <button
                                onClick={() => {
                                    const currentIndex = chapters.findIndex(c => c.id === activeChapter);
                                    if (currentIndex > 0) setActiveChapter(chapters[currentIndex - 1].id);
                                }}
                                disabled={chapters.findIndex(c => c.id === activeChapter) === 0}
                                className="px-4 py-2 border rounded-xl hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent text-xs font-medium transition-colors"
                            >
                                ← Назад
                            </button>
                            <button
                                onClick={() => {
                                    const currentIndex = chapters.findIndex(c => c.id === activeChapter);
                                    if (currentIndex < chapters.length - 1) setActiveChapter(chapters[currentIndex + 1].id);
                                }}
                                disabled={chapters.findIndex(c => c.id === activeChapter) === chapters.length - 1}
                                className="px-4 py-2 bg-foreground text-background font-bold rounded-xl hover:bg-foreground/90 disabled:opacity-40 text-xs transition-colors"
                            >
                                Вперед →
                            </button>
                        </footer>

                    </article>
                </div>
            </main>

        </div>
    );
}
