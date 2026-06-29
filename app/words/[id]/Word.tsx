'use client';
import {isvToCyr, isvToTranscription, standardToSimple, standardToSimpleCyr} from "@/lib/isv";
import React, {useEffect, useMemo, useState} from "react";
import Link from "next/link";

const Word = ({ item, currentScript }: any) => {
    const [cognateWords, setCognateWords] = useState<any[]>([]);

    const word = item.value;
    const transcription = isvToTranscription(item.value);
    const cyrillicVariant = isvToCyr(item.value);
    const nslVariant = item.nsl;
    const scientificVariants = [
        standardToSimple(item.value),
        standardToSimpleCyr(item.value),
    ];
    const meta = {
        partOfSpeech: item.pos,
    };

    const definition = item.meanings?.meaning || "Здесь будет толкование";
    const examples = [
        {
            phrase: item.meanings?.examples,
            translation: item.meanings?.examples,
        },
    ];
    const etymologyLinks = [
        {
            label: "Этимология",
            url: item.etymology,
        }
    ];
    const translations = {
        "Английский": item.en?.value,
        "Русский": item.ru?.value,
        "Украинский": item.uk?.value,
        "Белорусский": item.be?.value,
        "Церковнославянский": item.cu?.value,
        "Болгарский": item.bg?.value,
        "Македонский": item.mk?.value,
        "Сербский": item.sr?.value,
        "Хорватский": item.hr?.value,
        "Словенский": item.sl?.value,
        "Польский": item.pl?.value,
        "Словацкий": item.sk?.value,
        "Чешский": item.cs?.value,
        "Немецкий": item.de?.value,
        "Нидерландский": item.nl?.value,
        "Эсперанто": item.eo?.value,
    };

    const title = useMemo(() => {
        if (currentScript === "CYRILLIC") {
            return `${cyrillicVariant} (${word})`
        }
        return `${word} (${cyrillicVariant})`;
    }, [currentScript, word, cyrillicVariant]);

    useEffect(() => {
        if (item.roots) {
            const rootId = item.roots[0]?.id;
            fetch(`/api/lexicon/${rootId}/root`)
                .then((res) => res.json())
                .then((data) => {
                    setCognateWords(data);
                });
        }
    }, [item.roots]);

    if (!item) {
        return (
            <div>
                Информация отсутствует
            </div>
        );
    }

    // Толкование на русском: https://gufo.me/dict/ozhegov/:word
    return (
        <article className="max-w-3xl mx-auto mb-8 bg-white p-6 md:p-8 rounded-2xl shadow-md border border-slate-100 h-auto">

            {/* 1. Заголовок (Слово и Транскрипция) */}
            <header className="border-b border-slate-200 pb-4 mb-5 flex items-baseline gap-4 flex-wrap">
                <h1 className="text-4xl font-bold text-slate-800 tracking-tight">{title}</h1>
                <span className="font-mono text-slate-400 text-lg">{transcription}</span>
            </header>

            {/* 2. Варианты написания */}
            <div className="bg-slate-50 p-4 rounded-lg mb-6 text-sm text-slate-700 space-y-2">
                {nslVariant && (
                    <div>
                        <span className="font-semibold text-slate-600">Кириллица новословницы:</span> {nslVariant}
                    </div>
                )}
                <div>
                    <span className="font-semibold text-slate-600">Простая форма:</span>{' '}
                    <span className="space-x-2">
            {scientificVariants.map((variant, idx) => (
                <span key={idx} className="after:content-[','] last:after:content-none font-medium">
                {variant}
              </span>
            ))}
          </span>
                </div>
            </div>

            {/* 3. Краткая мета-информация */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border border-slate-200 rounded-lg mb-6 text-sm">
                <div>
                    <span className="block font-semibold text-slate-500">Часть речи</span>
                    <span className="text-slate-800">{meta.partOfSpeech}</span>
                </div>
                {meta.gender && (
                    <div>
                        <span className="block font-semibold text-slate-500">Род</span>
                        <span className="text-slate-800">{meta.gender}</span>
                    </div>
                )}
                {meta.stemType && (
                    <div>
                        <span className="block font-semibold text-slate-500">Тип основы</span>
                        <span className="text-slate-800">{meta.stemType}</span>
                    </div>
                )}
                <div>
                    <span className="block font-semibold text-slate-500">ID статьи</span>
                    <span className="text-slate-400 font-mono">#{meta.id}</span>
                </div>
            </div>

            {/* 4. Значение слова */}
            <section className="mb-6">
                <h2 className="text-lg font-bold text-slate-800 border-l-4 border-blue-600 pl-3 mb-2">Значение</h2>
                <p className="text-base md:text-lg text-slate-700 leading-relaxed">{definition}</p>
            </section>

            {cognateWords?.length > 0 && (
                <section className="mb-6">
                    <h2 className="text-base font-bold text-slate-400 uppercase tracking-wider mb-2.5">Однокоренные слова</h2>
                    <div className="flex flex-wrap gap-2">
                        {cognateWords.map((item, idx) => (
                            <Link
                                key={idx}
                                href={`/words/${item.id}`}
                                className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-200/70 hover:border-blue-200 px-3 py-1.5 rounded-xl text-slate-800 hover:text-blue-700 font-medium text-sm transition-all duration-150 shadow-sm"
                            >
                                <span>{currentScript === "CYRILLIC" ? isvToCyr(item.value) : item.value}</span>
                                <span className="text-[10px] text-slate-400 font-normal uppercase bg-slate-200/50 px-1 rounded">
                                  {item.pos}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* 5. Примеры использования */}
            {examples.length > 0 && (
                <section className="mb-6">
                    <h2 className="text-lg font-bold text-slate-800 border-l-4 border-blue-600 pl-3 mb-3">Примеры использования</h2>
                    <ul className="space-y-3 pl-4 list-disc text-slate-700">
                        {examples.map((item, idx) => (
                            <li key={idx} className="italic">
                                {item.phrase}
                                <span className="block not-italic text-sm text-slate-500 mt-1">
                  «{item.translation}»
                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* 6. Переводы на другие языки */}
            <section className="mb-6">
                <h2 className="text-lg font-bold text-slate-800 border-l-4 border-blue-600 pl-3 mb-3">Переводы</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(translations).map(([lang, val]) => val ? (
                        <div
                            key={lang}
                            className="flex flex-col justify-center p-3 bg-slate-50 border border-slate-100 rounded-lg shadow-sm hover:bg-slate-100 transition-colors"
                        >
                            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-0.5">{lang}</span>
                            <span className="text-base font-medium text-slate-800">{val}</span>
                        </div>
                    ) : null)}
                </div>
            </section>

            {/* 7. Этимологические ссылки */}
            {etymologyLinks.length > 0 && (
                <section className="mt-8 pt-4 border-t border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 border-l-4 border-blue-600 pl-3 mb-3">Этимология и внешние ссылки</h2>
                    <ul className="space-y-2 text-sm">
                        {etymologyLinks.map((link, idx) => (
                            <li key={idx}>
                                <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                                >
                                    {link.label} <span>&rarr;</span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

        </article>
    );
};

export default Word;