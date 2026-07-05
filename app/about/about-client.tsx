"use client"

interface TechnicalAboutProps {
    data: {
        wordCount: string
        meaningCount: string
        rootCount: string
        languageCount: number
        environment: string
        nextVersion: string
        ormVersion: string
    }
}

interface VersionHistory {
    version: string;
    year: string;
    title: string;
    description?: string;
}

const versions: VersionHistory[] = [
    {
        version: "v 1.0",
        year: "2015",
        title: "Словник Новословницы",
        description: "Первая база слов Новословницы и начальная фиксация лексических норм."
    },
    {
        version: "v 2.0+",
        year: "2016",
        title: "Мрежны словник Новословницы",
        description: "Переход в онлайн-формат, запуск веб-версии и расширение базы данных."
    },
    {
        version: "v 3.0",
        year: "2019",
        title: "Common Web Interslavic Dictionary",
        description: "Интеграция со стандартами межславянского языка."
    },
    {
        version: "v 4.0",
        year: "2026",
        title: "Interslavic Lexicon",
        description: "Текущая версия. Полное обновление архитектуры, современный интерфейс и инструменты экосистемы. Формирование текстового корпуса междуславянского."
    }
];

export function TechnicalAboutClient({ data }: TechnicalAboutProps) {
    return (
        // Добавили h-full, overflow-y-auto для скролла контента и pb-12 для отступа снизу
        <div className="h-full overflow-y-auto max-w-4xl mx-auto px-4 md:px-6 pb-12 space-y-12 animate-fade-in text-sm no-scrollbar">

            {/* ЗАГОЛОВОК И КРАТКАЯ СПРАВКА */}
            <div className="space-y-3">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    О программе / Спецификация
                </h1>
                <p className="text-muted-foreground leading-relaxed">
                    Электронный лексикон представляет собой специализированную реляционную базу данных
                    межславянского языка (Medžuslovjansky). Программа разработана для автоматизации
                    процессов многоязычного перевода, анализа этимологических гнезд и управления
                    морфемным составом слов.
                </p>
            </div>

            {/* РАЗДЕЛ 1: МАТРИЦА СИСТЕМНЫХ ХАРАКТЕРИСТИК (ТАБЛИЦА) */}
            <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-1">
                    1. Системные метрики и статистика БД
                </h2>
                <div className="border rounded-xl bg-background overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <tbody className="divide-y text-xs">
                        <tr className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-semibold text-muted-foreground w-1/2">Общее количество лексем (words)</td>
                            <td className="p-3 font-mono text-foreground">{data.wordCount}</td>
                        </tr>
                        <tr className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-semibold text-muted-foreground">Индексированных корней и морфем (roots)</td>
                            <td className="p-3 font-mono text-foreground">{data.rootCount}</td>
                        </tr>
                        <tr className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-semibold text-muted-foreground">Связанных семантических значений (meanings)</td>
                            <td className="p-3 font-mono text-foreground">{data.meaningCount}</td>
                        </tr>
                        <tr className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-semibold text-muted-foreground">Поддерживаемые целевые славянские языки</td>
                            <td className="p-3 font-mono text-foreground">{data.languageCount} (изолированные таблицы)</td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* РАЗДЕЛ 2: ЛИНГВИСТИЧЕСКИЕ И ОРФОГРАФИЧЕСКИЕ СТАНДАРТЫ */}
            <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-1">
                    2. Алгоритмы орфографии и стандарты данных
                </h2>
                <div className="p-4 border rounded-xl bg-background space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Программа поддерживает динамическое переключение графических систем без перезагрузки страниц
                        интерфейса. Детекция и вывод осуществляются по следующим правилам:
                    </p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                        <li>При наличии активной сессии пользователя применяется конфигурация из таблицы `user_settings` базы `auth`.</li>
                        <li>Для неавторизованных пользователей парсится HTTP-заголовок `Accept-Language` локали браузера с автоматическим вычислением латинских локалей славянских стран (pl, cs, sk, hr, sl).</li>
                        <li>Транслитерация латиницы опирается на стандартную нотацию межславянского алфавита (**isv**), включая спецсимволы (č, ž, š, ě).</li>
                    </ul>
                </div>
            </div>

            {/* РАЗДЕЛ 3: СВЯЗАННЫЕ ПРОЕКТЫ (НОВЫЙ РАЗДЕЛ) */}
            <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-1">
                    3. Связанные проекты сообщества
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Рекомендуемые внешние ресурсы и официальные платформы межславянского комьюнити, дополняющие инфраструктуру лексикона:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Проект 1: Официальный портал */}
                    <div className="p-4 border rounded-xl bg-background space-y-1">
                        <span className="font-bold text-xs block text-foreground">Interslavic Language Portal</span>
                        <span className="text-xs text-muted-foreground block leading-normal">
              Главный информационный веб-сайт языка: грамматика, история, правила и стандарты.
            </span>
                        <a
                            href="http://interslavic-language.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block pt-1 font-medium"
                        >
                            interslavic-language.org →
                        </a>
                    </div>

                    {/* Проект 2: Динамический переводчик слов */}
                    <div className="p-4 border rounded-xl bg-background space-y-1">
                        <span className="font-bold text-xs block text-foreground">Interslavic Dictionary Service</span>
                        <span className="text-xs text-muted-foreground block leading-normal">
              Многоязычный словарный веб-сервис и база данных, развиваемая участниками сообщества.
            </span>
                        <a
                            href="https://interslavic-dictionary.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block pt-1 font-medium"
                        >
                            interslavic-dictionary.com →
                        </a>
                    </div>

                    {/* Проект 3: Межславянские новости */}
                    <div className="p-4 border rounded-xl bg-background space-y-1 hover:border-blue-500/30 transition-colors">
                        <span className="font-bold text-xs block text-foreground">Interslavic Community (Facebook)</span>
                        <span className="text-xs text-muted-foreground block leading-normal">
                          Крупнейшее официальное международное сообщество для общения, практики и координации развития межславянского языка.
                        </span>
                        <a
                            href="https://www.facebook.com/groups/interslavic/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block pt-1 font-medium"
                        >
                            facebook.com/groups/interslavic →
                        </a>
                    </div>

                    {/* Проект 4: Группа в Смежной сети */}
                    <div className="p-4 border rounded-xl bg-background space-y-1 hover:border-blue-500/30 transition-colors">
                        <span className="font-bold text-xs block text-foreground">Interslavic Wiki</span>
                        <span className="text-xs text-muted-foreground block leading-normal">
                          Открытая база знаний и вики-энциклопедия статей, написанная и модерируемая участниками комьюнити.
                        </span>
                        <a
                            href="https://wikipedia.org" // Или актуальная ссылка на вики-сообщество проекта
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block pt-1 font-medium"
                        >
                            isv.wikipedia.org →
                        </a>
                    </div>
                </div>
            </div>

            {/* РАЗДЕЛ 4: КОНТАКТЫ И ОБРАТНАЯ СВЯЗЬ */}
            <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-1">
                    4. Контакты и обратная связь
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Если вы нашли неточность в переводе словарной статьи, хотите предложить улучшение алгоритмов транслитерации или запросить расширенные права модератора (с доступом к конкретным языковым группам), свяжитесь с нами:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Канал 1: Email */}
                    <div className="p-4 border rounded-xl bg-background space-y-1">
                        <span className="font-bold text-xs block text-foreground">Электронная почта</span>
                        <span className="text-xs text-muted-foreground block">
                          Для официальных запросов и координации:
                        </span>
                        <a
                            href="mailto:support@interslavic-lexicon.com"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block pt-1 font-mono"
                        >
                            support@interslavic-lexicon.com
                        </a>
                    </div>

                    {/* Канал 2: Telegram */}
                    <div className="p-4 border rounded-xl bg-background space-y-1">
                        <span className="font-bold text-xs block text-foreground">Сообщество и поддержка</span>
                        <span className="text-xs text-muted-foreground block">
              Оперативное обсуждение и чат разработчиков:
            </span>
                        <a
                            href="https://t.me" // Замените на реальный адрес вашей группы при наличии
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block pt-1 font-medium"
                        >
                            t.me/interslavic
                        </a>
                    </div>
                </div>
            </div>

            {/* РАЗДЕЛ 4: ОТКРЫТЫЙ ИСХОДНЫЙ КОД */}
            <div className="border border-dashed rounded-xl p-4 bg-muted/10 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                    <h3 className="font-bold text-xs text-foreground">Открытый исходный код (Open Source)</h3>
                    <p className="text-xs text-muted-foreground">
                        Проект и архитектурные наработки лексикона публикуются в репозитории GitHub сообщества.
                    </p>
                </div>
                <a
                    href="https://github.com/nowoslownica/interlex"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-background border rounded-md text-xs font-semibold hover:bg-muted transition-colors shrink-0 shadow-sm"
                >
                    Репозиторий GitHub →
                </a>
            </div>

            <section className="mt-12">
                <h2 className="text-sm font-bold uppercase tracking-wider text-black border-b border-black pb-2 mb-4">
                    5. История версий
                </h2>

                <p className="text-xs text-neutral-600 mb-6 leading-relaxed">
                    Эволюция развития веб-версии проекта:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {versions.map((item, index) => (
                        <div
                            key={index}
                            className="border border-neutral-300 rounded-lg p-5 bg-white flex flex-col justify-between hover:border-neutral-400 transition-colors"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                                    {item.version}
                                  </span>
                                  <span className="text-xs font-medium text-neutral-400">
                                    {item.year}
                                  </span>
                                </div>
                                <h3 className="text-sm font-bold text-black mb-1">
                                    {item.title}
                                </h3>
                                <p className="text-xs text-neutral-500 leading-relaxed">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
