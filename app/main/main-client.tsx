import Link from 'next/link';
import {useTranslations} from "next-intl";
import {WordOfDayWidget} from "@/app/main/ⷰ҇WordsOfTheDay";
import {Word} from "@/prisma/generated/data/client";

interface StatsProps {
    stats: {
        words: number;
        languages: number;
        roots: number;
        meanings: number;
    };
    randomWord: Word;
}

export default function MainClient({ stats, randomWord }: StatsProps) {
    return (
        // max-w-7xl ограничивает контент на 1280px, что идеально центрирует его на 1920px без чрезмерного растягивания строк текста
        <main className="flex-1 h-full overflow-y-auto max-w-7xl mx-auto px-4 md:px-8 2xl:px-12 pb-24 md:pb-32 space-y-16 md:space-y-24 animate-fade-in text-sm no-scrollbar py-8">

            {/* СЕКЦИЯ 1: ГЛАВНЫЙ БАННЕР */}
            <section className="text-center space-y-6 max-w-4xl mx-auto pt-4 md:pt-12">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400">
                    🌍 Электронный лексикон
                </div>
                <h1 className="text-3xl md:text-5xl 2xl:text-6xl font-black tracking-tight text-foreground leading-tight">
                    Межславянский электронный словарь
                </h1>
                <p className="text-base md:text-lg 2xl:text-xl text-muted-foreground leading-relaxed">
                    Профессиональный инструмент для лингвистических исследований, перевода и изучения
                    междуславянского языка. Платформа объединяет классические славянские корни и современные языковые формы.
                </p>
            </section>

            {/* СЕКЦИЯ 2: ОПИСАНИЕ И ОСОБЕННОСТИ ПРОГРАММЫ */}
            <section className="space-y-8 max-w-6xl mx-auto">
                <h2 className="text-xl md:text-2xl font-bold text-foreground border-b pb-3">Основные возможности платформы</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 2xl:gap-12">
                    <div className="flex gap-4 items-start">
                        <div className="p-2 rounded-lg bg-muted text-foreground font-bold text-sm h-10 w-10 flex items-center justify-center shrink-0" aria-hidden="true">
                            Aa
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="font-bold text-base">Умная орфография (Скрипты)</h3>
                            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                                Система автоматически подстраивается под локаль вашего браузера или личные настройки,
                                переключая отображение межславянских слов между кириллицей и латиницей (<code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">isv</code> нотация).
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="p-2 rounded-lg bg-muted text-foreground font-bold text-sm h-10 w-10 flex items-center justify-center shrink-0" aria-hidden="true">
                            🔗
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="font-bold text-base">Морфемный и семантический граф</h3>
                            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                                Слова не просто хранятся списком, а связаны в глубокую сеть синонимов, антонимов
                                и корневых групп, позволяя исследовать этимологию и семантическую близость лексем.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="p-2 rounded-lg bg-muted text-foreground font-bold text-sm h-10 w-10 flex items-center justify-center shrink-0" aria-hidden="true">
                            👥
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="font-bold text-base">Многоуровневая модерация</h3>
                            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                                Программа поддерживает строгую ролевую модель. Администраторы могут точечно распределять
                                права по языкам для модераторов, гарантируя качество и верификацию каждого перевода.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="p-2 rounded-lg bg-muted text-foreground font-bold text-sm h-10 w-10 flex items-center justify-center shrink-0" aria-hidden="true">
                            ⚡
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="font-bold text-base">Высокая производительность</h3>
                            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                                Благодаря архитектуре Next.js App Router и оптимизированным индексам SQLite,
                                поиск по десяткам тысяч слов и связь композитов происходят на клиенте за доли секунды.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* СЕКЦИЯ 3: ЖИВАЯ СТАТИСТИКА (ИНФОГРАФИКА) — СДВИНУТА НИЖЕ */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto" aria-label="Статистика лексикона">
                <div className="p-6 md:p-8 border rounded-2xl bg-background shadow-sm text-center space-y-2 transition-all hover:shadow-md hover:border-muted-foreground/20">
                    <span className="block text-3xl md:text-4xl 2xl:text-5xl font-black text-blue-600">{stats.words}</span>
                    <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest">Всего слов</span>
                </div>
                <div className="p-6 md:p-8 border rounded-2xl bg-background shadow-sm text-center space-y-2 transition-all hover:shadow-md hover:border-muted-foreground/20">
                    <span className="block text-3xl md:text-4xl 2xl:text-5xl font-black text-foreground">{stats.languages}</span>
                    <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest">Языков перевода</span>
                </div>
                <div className="p-6 md:p-8 border rounded-2xl bg-background shadow-sm text-center space-y-2 transition-all hover:shadow-md hover:border-muted-foreground/20">
                    <span className="block text-3xl md:text-4xl 2xl:text-5xl font-black text-foreground">{stats.roots}</span>
                    <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest">Уникальных корней</span>
                </div>
                <div className="p-6 md:p-8 border rounded-2xl bg-background shadow-sm text-center space-y-2 transition-all hover:shadow-md hover:border-muted-foreground/20">
                    <span className="block text-3xl md:text-4xl 2xl:text-5xl font-black text-foreground">{stats.meanings}</span>
                    <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest">Смысловых значений</span>
                </div>
            </section>

            <WordOfDayWidget
                data={randomWord}
            />

            {/* СЕКЦИЯ 4: ПРИЗЫВ К ДЕЙСТВИЮ / ССЫЛКИ С АКЦЕНТОМ НА КНОПКАХ */}
            <section className="border border-dashed border-muted-foreground/30 rounded-3xl p-6 md:p-10 bg-muted/10 flex flex-col lg:flex-row items-center justify-between gap-8 max-w-6xl mx-auto">
                <div className="space-y-2 text-center lg:text-left max-w-xl">
                    <h3 className="font-bold text-base md:text-lg">Хотите внести вклад в развитие лексикона?</h3>
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                        Зарегистрируйтесь в системе, чтобы получить доступ к базовым функциям или запросить права модератора.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto shrink-0">
                    <Link
                        href="/textbook"
                        className="px-5 py-3 border border-input rounded-xl text-xs md:text-sm font-medium hover:bg-accent hover:text-accent-foreground bg-background/50 transition-all text-center w-full sm:w-auto order-3 sm:order-1"
                    >
                        Читать учебник
                    </Link>

                    {/* Акцентная кнопка 1: Поиск */}
                    <Link
                        href="/lexicon"
                        className="px-6 py-3 bg-blue-600 text-white font-bold text-xs md:text-sm rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 hover:-translate-y-0.5 text-center w-full sm:w-auto order-1 sm:order-2 active:translate-y-0"
                    >
                        Перейти к поиску 🔍
                    </Link>

                    {/* Акцентная кнопка 2: Переводчик */}
                    <Link
                        href="/translate"
                        className="px-6 py-3 bg-foreground text-background font-bold text-xs md:text-sm rounded-xl hover:bg-foreground/90 transition-all shadow-lg shadow-foreground/10 hover:shadow-foreground/20 hover:-translate-y-0.5 text-center w-full sm:w-auto order-2 sm:order-3 active:translate-y-0"
                    >
                        Перейти к переводчику ⚡
                    </Link>
                </div>
            </section>

        </main>
    );
}
