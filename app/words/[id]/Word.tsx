'use client';
import {isvToCyr, isvToTranscription, standardToSimple, standardToSimpleCyr} from "@/lib/isv";
import React, {useEffect, useMemo, useState} from "react";
import Link from "next/link";
import {extractProtoStems} from "@/lib/grammar/morphonology";
import {conjugateFullVerb} from "@/lib/grammar/verb/conjugator2";
import {VerbConjugationTables} from "@/app/words/[id]/VerbConjugationTables";
import {NounDeclensionTables} from "@/app/words/[id]/NounDeclensionTables";
import {AdjectiveDeclensionTables} from "@/app/words/[id]/AdjectiveDeclensionTables";
import {NumeralDeclensionTables} from "@/app/words/[id]/NumeralDeclensionTables";
import {PronounDeclensionTables} from "@/app/words/[id]/PronounDeclensionTables";
import {AdverbComparisonTables} from "@/app/words/[id]/AdverbComparisonTables";
import {declineWordAutomatically} from "@/lib/grammar/declineNoun";
import {PosType} from "@/lib/grammar/common";
import ReactMarkdown from "react-markdown";
import CognateRadarChart from "@/app/words/[id]/CognateRadarChart";
import MorphemeAnalysis from "@/app/words/[id]/MorphemeAnalysis";
import {ComprehensionWidget} from "@/app/words/[id]/ComprehensionWidget";
import {getExternalDictionaryUrl} from "@/lib/dictionary/helper";
import SynonymGraph from "@/app/words/[id]/SynonymGraph";

const Word = ({ item, currentScript }: any) => {
    const [cognateWords, setCognateWords] = useState<any[]>([]);
    const [synonymGraphMeaning, setSynonymGraphMeaning] = useState<any | null>(null);

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
        gender: item.gender,
        declension: item.declension,
        conjugation: item.conjugation,
        protoStemClass: item.protoStemClass,
        paradigm: item.paradigm,
        stem: item.stem,
        aspect: item.aspect,
        transitivity: item.transitivity,
        animacy: item.animacy,
    };

    const [showParadigm, setShowParadigm] = useState<boolean>(false);

    const isVerb = meta.partOfSpeech === PosType.VERB;
    const isNoun = meta.partOfSpeech === PosType.NOUN;
    const isAdj = meta.partOfSpeech === PosType.ADJ;
    const isNum = meta.partOfSpeech === PosType.NUM;
    const isPron = meta.partOfSpeech === PosType.PRON;
    const isAdv = meta.partOfSpeech === PosType.ADV;
    const hasParadigm = isVerb || isNoun || isAdj || isNum || isPron || isAdv;

    // На лету вычисляем глагольную парадигму, если это глагол
    let verbData = null;
    if (isVerb) {
        try {
            const stems = extractProtoStems(item.value);
            verbData = conjugateFullVerb({
                infinitive: item.value,
                infStem: stems.infStem,
                presentStem: stems.presentStem,
                aoristStem: stems.aoristStem,
                verbClass: stems.verbClass,
                aspect: meta.aspect || 'imperfective'
            });
        } catch (e) {
            console.error("Ошибка генерации парадигмы глагола:", e);
        }
    }

    let nounData;
    if (isNoun) {
        try {
            const CASES_LIST = [
                { key: 'nominative', label: 'Именительный', short: 'Им.' },
                { key: 'genitive', label: 'Родительный', short: 'Род.' },
                { key: 'dative', label: 'Дательный', short: 'Дат.' },
                { key: 'accusative', label: 'Винительный', short: 'Вин.' },
                { key: 'instrumental', label: 'Творительный', short: 'Твор.' },
                { key: 'locative', label: 'Местный', short: 'Мест.' },
                { key: 'vocative', label: 'Звательный', short: 'Зват.' },
            ] as const;

            const NUMBERS_LIST = [
                { key: 'singular', title: 'Единственное (Sg)' },
                { key: 'dual', title: 'Двойственное (Du)' },
                { key: 'plural', title: 'Множественное (Pl)' },
            ] as const;

            const paradigmData: Record<string, Record<string, string>> = {
                singular: {},
                dual: {},
                plural: {},
            };

            for (const num of NUMBERS_LIST) {
                for (const c of CASES_LIST) {
                    try {
                        paradigmData[num.key][c.key] = declineWordAutomatically({
                            dbItem: {
                                interslavic: item.value,
                                protoSlavic: item.value,
                                gender: item.gender || "masculine",
                                protoStemClass: item.protoStemClass || "u",
                                paradigm: item.paradigm || "A",
                            },
                            targetCase: c.key,
                            targetNumber: num.key,
                        });
                    } catch (error) {
                        console.error(`Ошибка генерации формы: ${num.key} ${c.key}`, error);
                        paradigmData[num.key][c.key] = '—';
                    }
                }
            }

            nounData = paradigmData;
        } catch {
            console.log('Не удалось загрузить модуль деклинования');
        }
    }

    const meaningsArray = Array.isArray(item.meanings) ? item.meanings : (item.meanings ? [item.meanings] : []);

    const LANG_CONFIG: Record<string, { label: string; data: any[] | null | undefined }> = {
        en: { label: "Английский", data: item.en },
        ru: { label: "Русский", data: item.ru },
        uk: { label: "Украинский", data: item.uk },
        be: { label: "Белорусский", data: item.be },
        cu: { label: "Церковнославянский", data: item.cu },
        bg: { label: "Болгарский", data: item.bg },
        mk: { label: "Македонский", data: item.mk },
        sr: { label: "Сербский", data: item.sr },
        hr: { label: "Хорватский", data: item.hr },
        sl: { label: "Словенский", data: item.sl },
        pl: { label: "Польский", data: item.pl },
        sk: { label: "Словацкий", data: item.sk },
        cs: { label: "Чешский", data: item.cs },
        de: { label: "Немецкий", data: item.de },
        nl: { label: "Нидерландский", data: item.nl },
        eo: { label: "Эсперанто", data: item.eo },
    };

    const getTranslationsForMeaning = (meaningId: number) => {
        const result: Record<string, string> = {};
        for (const [code, cfg] of Object.entries(LANG_CONFIG)) {
            if (!Array.isArray(cfg.data)) continue;
            const match = cfg.data.find((t: any) => t.meaningId === meaningId);
            if (match?.value) {
                result[code] = match.value;
            }
        }
        return result;
    };

    const etymologyLinks = [
        ...(item.proto ? [
            {
                label: "Реконструкция",
                url: `https://en.wiktionary.org/wiki/Reconstruction:Proto-Slavic/${item.proto}`,
            },
            {
                label: "Этимология",
                url: `/proto/${item.proto}`
            }
        ] : [
            {
                label: "Этимология",
                url: item.etymology,
            },
        ])
    ];

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
                    setCognateWords(data.filter((w: any) => w.id !== item.id));
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

    return (
        <>
        <article className="max-w-3xl mx-auto mb-8 bg-white p-6 md:p-8 rounded-2xl shadow-md border border-slate-100 h-auto">

            {/* 1. Заголовок (Слово и Траскрипция) */}
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

            {/* 2.5. Морфемный разбор */}
            <MorphemeAnalysis
                word={item.value}
                roots={item.roots}
                base={item.stem}
                currentScript={currentScript}
            />

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
                {meta.declension != null && (
                    <div>
                        <span className="block font-semibold text-slate-500">Склонение</span>
                        <span className="text-slate-800">{meta.declension}</span>
                    </div>
                )}
                {meta.conjugation != null && (
                    <div>
                        <span className="block font-semibold text-slate-500">Спряжение</span>
                        <span className="text-slate-800">{meta.conjugation}</span>
                    </div>
                )}
                {meta.stem && (
                    <div>
                        <span className="block font-semibold text-slate-500">Основа</span>
                        <span className="text-slate-800">{meta.stem}</span>
                    </div>
                )}
                {meta.protoStemClass && (
                    <div>
                        <span className="block font-semibold text-slate-500">Класс основы</span>
                        <span className="text-slate-800">{meta.protoStemClass}</span>
                    </div>
                )}
                {meta.paradigm && (
                    <div>
                        <span className="block font-semibold text-slate-500">Парадигма</span>
                        <span className="text-slate-800">{meta.paradigm}</span>
                    </div>
                )}
                {meta.aspect && (
                    <div>
                        <span className="block font-semibold text-slate-500">Вид</span>
                        <span className="text-slate-800">{meta.aspect}</span>
                    </div>
                )}
                {meta.transitivity && (
                    <div>
                        <span className="block font-semibold text-slate-500">Переходность</span>
                        <span className="text-slate-800">{meta.transitivity}</span>
                    </div>
                )}
                {meta.animacy && (
                    <div>
                        <span className="block font-semibold text-slate-500">Одушевлённость</span>
                        <span className="text-slate-800">{meta.animacy}</span>
                    </div>
                )}
                <div>
                    <span className="block font-semibold text-slate-500">ID статьи</span>
                    <span className="text-slate-400 font-mono">#{item.id}</span>
                </div>
            </div>

            <ComprehensionWidget comprehensionData={item.intelligibility} />

            {(hasParadigm) && (
                <div className="mb-6 border-b border-slate-100 pb-6">
                    <button
                        onClick={() => setShowParadigm(!showParadigm)}
                        className="w-full flex items-center justify-between p-3.5 bg-blue-50/50 hover:bg-blue-50 border border-blue-100/70 rounded-xl text-blue-700 font-semibold text-sm transition-all duration-150 shadow-sm"
                    >
                        <span className="flex items-center gap-2">
                            📊 {
                                isVerb ? 'Показать спряжение глагола (3 числа, 6 времён)'
                                : isNoun ? 'Показать таблицы склонения существительного'
                                : isAdj ? 'Показать склонение прилагательного'
                                : isNum ? 'Показать склонение числительного'
                                : isPron ? 'Показать склонение местоимения'
                                : isAdv ? 'Показать степени сравнения наречия'
                                : 'Показать парадигму'
                            }
                        </span>
                            <span className={`transform transition-transform duration-200 ${showParadigm ? 'rotate-180' : ''}`}>
                            ▼
                        </span>
                    </button>

                    {showParadigm && (
                        <div className="mt-4 p-1 bg-slate-50/50 rounded-xl border border-slate-100 animate-fadeIn">
                            {isVerb && verbData ? (
                                <VerbConjugationTables data={verbData} />
                            ) : isNoun && nounData ? (
                                <NounDeclensionTables data={nounData} />
                            ) : isAdj ? (
                                <AdjectiveDeclensionTables
                                    isv={item.value}
                                    paradigm={item.paradigm || 'A'}
                                    protoStemClass={item.protoStemClass || 'o'}
                                    isQualitative={!item.value.endsWith('ovy') && !item.value.endsWith('evy') && !item.value.endsWith('sky')}
                                />
                            ) : isNum ? (
                                <NumeralDeclensionTables
                                    isv={item.value}
                                    paradigm={item.paradigm || 'A'}
                                />
                            ) : isPron ? (
                                <PronounDeclensionTables
                                    isv={item.value}
                                    paradigm={item.paradigm || 'A'}
                                />
                            ) : isAdv ? (
                                <AdverbComparisonTables isv={item.value} />
                            ) : (
                                <div className="p-4 text-sm text-slate-500 italic text-center">
                                    Ошибка загрузки данных форм слова.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 4. Однокоренные слова */}
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

            {/* 5. Значения */}
            <section className="mb-6">
                <h2 className="text-lg font-bold text-slate-800 border-l-4 border-blue-600 pl-3 mb-3">Значения</h2>

                {meaningsArray.length === 0 && (
                    <p className="text-base md:text-lg text-slate-500 italic leading-relaxed">
                        Здесь будет толкование
                    </p>
                )}

                {meaningsArray.map((m: any, idx: number) => {
                    const meaningTranslations = m.id ? getTranslationsForMeaning(m.id) : {};
                    const hasTranslations = Object.keys(meaningTranslations).length > 0;

                    return (
                        <div key={m.id || idx}>
                            {idx > 0 && (
                                <hr className="my-5 border-t-2 border-slate-200" />
                            )}

                            <div className="space-y-3">
                                {meaningsArray.length > 1 && (
                                    <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                                        Значение {idx + 1}
                                    </span>
                                )}

                                <div className="text-base md:text-lg text-slate-700 leading-relaxed">
                                   <ReactMarkdown>
                                       {m.meaning || "Здесь будет толкование"}
                                   </ReactMarkdown>
                                </div>

                                {m.examples && (
                                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 pl-4">
                                        <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase block mb-1">
                                            Пример
                                        </span>
                                        <div className="italic text-slate-600 text-sm leading-relaxed">
                                            <ReactMarkdown>
                                                {`«${m.examples}»`}
                                            </ReactMarkdown>

                                        </div>
                                    </div>
                                )}

                                {hasTranslations && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                        {Object.entries(meaningTranslations).map(([lang, val]) => (
                                            <div
                                                key={lang}
                                                className="flex flex-col justify-center p-2.5 bg-slate-50 border border-slate-100 rounded-lg shadow-sm"
                                            >
                                                <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-0.5">{LANG_CONFIG[lang].label}</span>
                                                <span className="text-base font-medium text-slate-800">
                                                    {val.split(",").map((word, index) => (
                                                        <Link
                                                            key={word}
                                                            target="_blank"
                                                            href={getExternalDictionaryUrl(lang, word) || "#"}
                                                        >
                                                            {!!index && ', '}{word}
                                                        </Link>
                                                    ))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {m.synonyms?.length > 0 && (
                                    <div className="mt-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold tracking-wider text-green-600 uppercase">Синонимы</span>
                                            <button
                                                onClick={() => setSynonymGraphMeaning(m)}
                                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-green-500 hover:bg-green-600 px-2 py-0.5 rounded-full transition-colors shadow-sm"
                                                title="Граф синонимов"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="5" r="2.5"/>
                                                    <circle cx="5" cy="19" r="2.5"/>
                                                    <circle cx="19" cy="19" r="2.5"/>
                                                    <line x1="12" y1="7.5" x2="5" y2="16.5"/>
                                                    <line x1="12" y1="7.5" x2="19" y2="16.5"/>
                                                </svg>
                                                Граф
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {m.synonyms.map((syn: any) => (
                                                <Link
                                                    key={syn.targetMeaningId}
                                                    href={`/words/${syn.targetWordId}`}
                                                    className="inline-flex items-center gap-1 bg-green-50 hover:bg-green-100 border border-green-200 px-2 py-1 rounded-lg text-sm text-green-800 hover:text-green-900 transition-colors"
                                                >
                                                    <span>{currentScript === "CYRILLIC" ? isvToCyr(syn.targetWord) : syn.targetWord}</span>
                                                    {syn.targetMeaning && (
                                                        <span className="text-[11px] text-green-500">— {syn.targetMeaning}</span>
                                                    )}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {m.antonyms?.length > 0 && (
                                    <div className="mt-2">
                                        <span className="text-xs font-semibold tracking-wider text-red-600 uppercase">Антонимы</span>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {m.antonyms.map((ant: any) => (
                                                <Link
                                                    key={ant.targetMeaningId}
                                                    href={`/words/${ant.targetWordId}`}
                                                    className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg text-sm text-red-800 hover:text-red-900 transition-colors"
                                                >
                                                    <span>{currentScript === "CYRILLIC" ? isvToCyr(ant.targetWord) : ant.targetWord}</span>
                                                    {ant.targetMeaning && (
                                                        <span className="text-[11px] text-red-500">— {ant.targetMeaning}</span>
                                                    )}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </section>

            {/* 6. Диаграмма когнатов */}
            <CognateRadarChart item={item} />

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

            {synonymGraphMeaning && (
                <SynonymGraph
                    word={word}
                    wordId={item.id}
                    currentScript={currentScript}
                    firstLevelSynonyms={synonymGraphMeaning.synonyms || []}
                    onClose={() => setSynonymGraphMeaning(null)}
                />
            )}

        </>
    );
};

export default Word;