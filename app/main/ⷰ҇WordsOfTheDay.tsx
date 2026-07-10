import React from 'react';
import Link from 'next/link';
import {isvToCyr} from "@/lib/isv";

interface WordOfDayData {
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

interface WordOfDayWidgetProps {
    data: WordOfDayData;
}

export const WordOfDayWidget: React.FC<WordOfDayWidgetProps> = ({ data }) => {
    return (
        <div className="w-full max-w-7xl mx-auto px-4 mb-12">
            <Link
                href={`/words/${data.id}`}
                className="group block relative overflow-hidden rounded-2xl border transition-all duration-300
      /* Светлая тема */
      border-slate-200 bg-slate-50/50 p-6 shadow-sm hover:border-blue-500/50 hover:bg-white hover:shadow-md
      /* Темная тема */
      dark:border-slate-800 dark:bg-slate-900/40 dark:shadow-none dark:hover:border-blue-500/40 dark:hover:bg-slate-900/60"
            >
                {/* Эффект неонового свечения при наведении (только для темной темы) */}
                <div className="absolute -inset-px bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-indigo-500/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:block hidden" />

                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                    {/* Левый блок: Оригинал слова */}
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold tracking-wide
                            /* Светлая тема */
                            bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-500/20
                            /* Темная тема */
                            dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20"
                          >
                            Слово дня
                          </span>
                                            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                            {data.pos}
                          </span>
                        </div>

                        <div className="mt-2 flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold tracking-tight transition-colors
            /* Светлая тема */
            text-slate-900 group-hover:text-blue-600
            /* Темная тема */
            dark:text-white dark:group-hover:text-blue-400"
                            >
                                {isvToCyr(data.value)}
                            </h3>
                            <span className="text-sm font-medium font-mono text-slate-500 dark:text-slate-400">
                            ({data.isv})
                          </span>
                        </div>
                    </div>

                    {/* Правый блок: Перевод значения */}
                    <div className="flex flex-col sm:items-end justify-center max-w-md">
                        <span className="text-xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                          Значение
                        </span>
                        <p className="text-lg font-semibold sm:text-right line-clamp-2 mt-0.5
                          /* Светлая тема */
                          text-slate-700
                          /* Темная тема */
                          dark:text-slate-200"
                        >
                            {data.meanings.map(m => m.ru_mean ? m.ru_mean[0]?.value : "").join(", ")}
                        </p>

                        <span className="mt-1.5 inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform duration-200">
                          Открыть статью
                                            <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </span>
                    </div>

                </div>
            </Link>
        </div>
    );
};
