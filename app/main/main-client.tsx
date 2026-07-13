import Link from 'next/link';
import {useTranslations} from "next-intl";
import {WordOfDayWidget} from "@/app/main/ⷰ҇WordsOfTheDay";

interface RandomWordResult {
    id: number;
    value: string | null;
    isv: string | null;
    pos: string | null;
    meanings: {
        id: number;
        ru_mean: { id: number; value: string | null }[];
        en_mean: { id: number; value: string | null }[];
    }[];
}

interface StatsProps {
    stats: {
        words: number;
        languages: number;
        roots: number;
        meanings: number;
    };
    randomWord: RandomWordResult;
    subStats: any[];
}

export default function MainClient({ stats, subStats, randomWord }: StatsProps) {
    const t = useTranslations("main")
    return (
        // max-w-7xl ограничивает контент на 1280px, что идеально центрирует его на 1920px без чрезмерного растягивания строк текста
        <main className="flex-1 h-full overflow-y-auto max-w-7xl mx-auto px-4 md:px-8 2xl:px-12 pb-24 md:pb-32 space-y-16 md:space-y-24 animate-fade-in text-sm no-scrollbar py-8">

            {/* СЕКЦИЯ 1: ГЛАВНЫЙ БАННЕР */}
            <section className="text-center space-y-6 max-w-4xl mx-auto pt-4 md:pt-12">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400">
                    {t("badge")}
                </div>
                <h1 className="text-3xl md:text-5xl 2xl:text-6xl font-black tracking-tight text-foreground leading-tight">
                    {t("heading")}
                </h1>
                <p className="text-base md:text-lg 2xl:text-xl text-muted-foreground leading-relaxed">
                    {t("subtitle")}
                </p>
            </section>

            {/* СЕКЦИЯ 2: ОПИСАНИЕ И ОСОБЕННОСТИ ПРОГРАММЫ */}
            <section className="space-y-8 max-w-6xl mx-auto">
                <h2 className="text-xl md:text-2xl font-bold text-foreground border-b pb-3">{t("featuresTitle")}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 2xl:gap-12">
                    <div className="flex gap-4 items-start">
                        <div className="p-2 rounded-lg bg-muted text-foreground font-bold text-sm h-10 w-10 flex items-center justify-center shrink-0" aria-hidden="true">
                            Aa
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="font-bold text-base">{t("features.orthography.title")}</h3>
                            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                                {t.rich("features.orthography.description", {
                                    code: (chunks) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{chunks}</code>
                                })}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="p-2 rounded-lg bg-muted text-foreground font-bold text-sm h-10 w-10 flex items-center justify-center shrink-0" aria-hidden="true">
                            🔗
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="font-bold text-base">{t("features.morpheme.title")}</h3>
                            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                                {t("features.morpheme.description")}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="p-2 rounded-lg bg-muted text-foreground font-bold text-sm h-10 w-10 flex items-center justify-center shrink-0" aria-hidden="true">
                            👥
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="font-bold text-base">{t("features.crosslingual.title")}</h3>
                            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                                {t("features.crosslingual.description")}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="p-2 rounded-lg bg-muted text-foreground font-bold text-sm h-10 w-10 flex items-center justify-center shrink-0" aria-hidden="true">
                            ⚡
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="font-bold text-base">{t("features.corpus.title")}</h3>
                            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                                {t("features.corpus.description")}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* СЕКЦИЯ 3: ЖИВАЯ СТАТИСТИКА (ИНФОГРАФИКА) — СДВИНУТА НИЖЕ */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto" aria-label={t("stats.ariaLabel")}>
                <div className="p-6 md:p-8 border rounded-2xl bg-background shadow-sm text-center space-y-2 transition-all hover:shadow-md hover:border-muted-foreground/20">
                    <span className="block text-3xl md:text-4xl 2xl:text-5xl font-black text-blue-600">{stats.words}</span>
                    <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t("stats.totalWords")}</span>
                </div>
                <div className="p-6 md:p-8 border rounded-2xl bg-background shadow-sm text-center space-y-2 transition-all hover:shadow-md hover:border-muted-foreground/20">
                    <span className="block text-3xl md:text-4xl 2xl:text-5xl font-black text-foreground">{stats.languages}</span>
                    <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t("stats.translationLanguages")}</span>
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

            {/* Сетка карточек */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {subStats.map((stat) => (
                    <div
                        key={stat.id}
                        className="p-4 rounded-xl border transition-all duration-200
                       bg-slate-50/50 border-slate-200/60 text-slate-800
                       dark:bg-slate-900/30 dark:border-slate-800/80 dark:text-slate-200"
                    >
                        {/* Менее яркое число */}
                        <p className="text-xl font-medium tracking-tight md:text-2xl text-slate-700 dark:text-slate-300">
                            {stat.value}
                        </p>
                        {/* Мелкий второстепенный текст */}
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 line-clamp-1">
                            {stat.label}
                        </p>
                    </div>
                ))}
            </div>

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
