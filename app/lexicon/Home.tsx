'use client';
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {isvToCyr, standardToSimple} from "@/lib/isv";
import {mapNslToEtymologized} from "@/lib/nsl";
import {useTranslations} from "next-intl";
import {saveScriptPreference} from "@/app/settings/actions";
import BookmarkButton from "@/components/BookmarkButton";
import DiacriticsHelper from "@/components/DiacriticsHelper";
import {ScriptMode} from "@/lib/script-mode";
import {TRANSLATION_LANGUAGES} from "@/config/features";

import "./main-page.css";

const MAIN_CATEGORY_LABELS: Record<string, string> = {
  '': 'Вси категории',
  everyday_life: 'Бытова',
  nature: 'Природа',
  geography: 'География',
  history: 'История',
  religion: 'Религия',
  science: 'Наука',
  culture_art: 'Култура/Изкуство',
  medicine: 'Медицина',
  law_economy: 'Право/Економия',
  abstract: 'Абстрактно',
};

const USAGE_TYPE_LABELS: Record<string, string> = {
  '': 'Вси типы',
  general: 'Обще',
  colloquial: 'Разговорно',
  technical: 'Техническо',
  professional: 'Професионално',
  official: 'Официално',
  slang: 'Сленг',
  jargon: 'Жаргон',
  vulgar: 'Вулгарно',
  archaic: 'Архаично',
  historic: 'Историческо',
  neologism: 'Неологизам',
};

const PAGE_SIZE = 20

const WordCard = ({ onClickCard, item, currentScript }: { onClickCard: any; item: any; currentScript: ScriptMode }) => {
    const wordValue = item.word?.value || item.value;
    const cyrillicVariant = isvToCyr(wordValue);
    const latinVariant = wordValue.toLowerCase();
    const title = useMemo(() => {
        if (currentScript === ScriptMode.CYRILLIC) {
            return `${cyrillicVariant} (${latinVariant})`
        }
        return `${latinVariant} (${cyrillicVariant})`;
    }, [currentScript, cyrillicVariant]);

    return (
        <li
            className="card"
            onClick={onClickCard(item)}
        >
            <div className="card-title">{title}</div>
            <div className="card-meta">{`${item.pos}`}</div>
            <div className="card-desc">{item.meaningText}</div>
            <div className="absolute top-2 right-2">
                <BookmarkButton wordId={item.id} />
            </div>
        </li>
    )
}

export default function Home({ currentScript, isGuest }: { currentScript: ScriptMode; isGuest?: boolean; }) {
    const t = useTranslations("lexicon");
    const [searchValue, setSearchValue] = useState("");
    const [mainCategory, setMainCategory] = useState("");
    const [usageType, setUsageType] = useState("");
    // '' = обычный (прямой) поиск по ISV; код языка = реверс-словарь —
    // искать лексемы по значению на этом языке (roadmap п.45).
    const [reverseLang, setReverseLang] = useState("");
    const [formScript, setFormScript] = useState<ScriptMode>(currentScript);
    const [items, setItems] = useState<Array<any>>([]);
    const [hasFetched, setHasFetched] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [filtersVisible, setFiltersVisible] = useState(true);

    const router = useRouter();
    const searchParams = useSearchParams();

    const searchInputRef = useRef<HTMLInputElement>(null);
    const reverseSelectRef = useRef<HTMLSelectElement>(null);

    const performSearch = useCallback((query: string, mc: string, ut: string, lang: string) => {
        setIsLoading(true);
        setVisibleCount(PAGE_SIZE);
        const url = lang
            ? `/api/lexicon/reverse?${new URLSearchParams({ search: query, lang, limit: '50', offset: '0' })}`
            : (() => {
                const params = new URLSearchParams({ search: query, limit: '50', offset: '0' });
                if (mc) params.set('mainCategory', mc);
                if (ut) params.set('usageType', ut);
                return `/api/lexicon?${params}`;
            })();
        fetch(url)
            .then(res => res.json())
            .then((data) => {
                setItems(data);
                setHasFetched(true);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const executeSearch = useCallback(() => {
        // Реверс-поиск идёт по натуральному языку (ru/en/...), а не по ISV —
        // кириллическую/этимологическую нормализацию форм ISV к нему
        // применять не нужно.
        const sValue = !reverseLang && formScript === ScriptMode.CYRILLIC
            ? standardToSimple(mapNslToEtymologized(searchValue))
            : searchValue;

        const params = new URLSearchParams({ q: searchValue });
        if (mainCategory) params.set('mainCategory', mainCategory);
        if (usageType) params.set('usageType', usageType);
        if (reverseLang) params.set('lang', reverseLang);
        performSearch(sValue, mainCategory, usageType, reverseLang);
        router.replace(`/lexicon?${params}`);
        setFiltersVisible(false);
    }, [searchValue, mainCategory, usageType, reverseLang, formScript, performSearch, router]);

    useEffect(() => {
        const q = searchParams.get('q');
        const mc = searchParams.get('mainCategory') || '';
        const ut = searchParams.get('usageType') || '';
        const lang = searchParams.get('lang') || '';
        if (q) {
            setSearchValue(q);
            setMainCategory(mc);
            setUsageType(ut);
            setReverseLang(lang);
            if (lang) {
                performSearch(q, mc, ut, lang);
                return;
            }
            const detectedScript = /[а-яА-ЯёЁ]/.test(q) ? ScriptMode.CYRILLIC : ScriptMode.LATIN;
            setFormScript(detectedScript);
            const normalized = detectedScript === ScriptMode.CYRILLIC
                ? standardToSimple(mapNslToEtymologized(q))
                : q;
            performSearch(normalized, mc, ut, '');
        }
    }, []);

    // Точка входа из футера (roadmap п.45, "Обратный поиск") - реверс-поиск
    // уже жил только как малозаметный select в этом же ряду фильтров, без
    // какой-либо ссылки на него откуда-либо ещё в приложении. Ряд фильтров
    // и так виден по умолчанию при первой загрузке (filtersVisible), так
    // что достаточно навести фокус на select.
    useEffect(() => {
        if (searchParams.get('reverse') === '1') {
            reverseSelectRef.current?.focus();
        }
    }, []);

    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter" && searchValue.trim()) {
            executeSearch();
        }
    }, [executeSearch, searchValue]);

    const onClickCard = useCallback((item) => () => {
        router.push(`/words/${item.id}`);
    }, [router]);

    const onChangeSearch = useCallback((e) => {
        setSearchValue(e.target.value);
    }, []);

    const toggleScript = useCallback(() => {
        setFormScript(prev => {
            const next = prev === ScriptMode.CYRILLIC ? ScriptMode.LATIN : ScriptMode.CYRILLIC;
            if (!isGuest) {
                saveScriptPreference(next).catch(() => {});
            }
            return next;
        });
    }, [isGuest]);

    const toggleFilters = useCallback(() => {
        setFiltersVisible(prev => !prev);
    }, []);

    return (
        <>
            <div className="search-container">
                <div className={`filter-row${filtersVisible ? '' : ' filter-row--collapsed'}`}>
                    <select
                        className="filter-select"
                        value={mainCategory}
                        onChange={e => setMainCategory(e.target.value)}
                        disabled={!!reverseLang}
                        title={reverseLang ? "Недоступно при реверс-поиске" : undefined}
                    >
                        {Object.entries(MAIN_CATEGORY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <select
                        className="filter-select"
                        value={usageType}
                        onChange={e => setUsageType(e.target.value)}
                        disabled={!!reverseLang}
                        title={reverseLang ? "Недоступно при реверс-поиске" : undefined}
                    >
                        {Object.entries(USAGE_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <button
                        className="script-switcher"
                        onClick={toggleScript}
                        title={formScript === ScriptMode.CYRILLIC ? "Преключи на латиницу" : "Преключи на кириллицу"}
                        disabled={!!reverseLang}
                    >
                        {formScript === ScriptMode.CYRILLIC ? "Кир" : "Lat"}
                    </button>
                    <select
                        ref={reverseSelectRef}
                        className="filter-select"
                        value={reverseLang}
                        onChange={e => setReverseLang(e.target.value)}
                        title="Искати по значению на другом языке (реверс-словарь)"
                    >
                        <option value="">Меджуслвнски → ...</option>
                        {TRANSLATION_LANGUAGES.map(lang => (
                            <option key={lang.code} value={lang.code}>
                                {lang.flag ? `${lang.flag} ` : ''}{lang.name} → Меджусл.
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        id="searchInput"
                        className="search-box flex-1"
                        placeholder={reverseLang ? "Слово на другом языке..." : t("searchPlaceholder")}
                        value={searchValue}
                        onKeyDown={onKeyDown}
                        onChange={onChangeSearch}
                        ref={searchInputRef}
                    />
                    <DiacriticsHelper
                        targetRef={searchInputRef}
                        value={searchValue}
                        onChange={setSearchValue}
                        defaultPanel={formScript === ScriptMode.CYRILLIC ? "cyrillic" : "latin"}
                    />
                    <button
                        className="search-btn"
                        onClick={toggleFilters}
                        title={filtersVisible ? "Сховати филтры" : "Показати филтры"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <button
                        className="search-btn"
                        onClick={executeSearch}
                        title="Искати"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {isGuest && (
                    <div className="flex items-center gap-1.5 px-1 mt-2 text-[11px] text-muted-foreground font-normal animate-fade-in">
                        <svg
                            className="h-3.5 w-3.5 shrink-0 text-gray-400 opacity-80"
                            xmlns="http://w3.org"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0a15.634 15.634 0 01-3.75-6.75A15.63 15.63 0 0112 7.5a15.626 15.626 0 013.75 6.75A15.63 15.63 0 0112 21zm-8.625-7.5h17.25" />
                        </svg>
                        <span>{t("guestBanner")}</span>
                    </div>
                )}
            </div>

            <div className="scroll-container">
                {isLoading && (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                )}

                {!isLoading && items.length > 0 && (
                    <>
                        <ul id="cardGrid" className="card-grid">
                            {items.slice(0, visibleCount).map((item) => (
                                <WordCard
                                    key={item.id}
                                    onClickCard={onClickCard}
                                    item={item}
                                    currentScript={formScript}
                                />
                            ))}
                        </ul>
                        {visibleCount < items.length && (
                            <div className="flex justify-center py-6">
                                <button
                                    onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-all shadow-sm text-sm"
                                >
                                    {t("loadMore")} ({items.length - visibleCount})
                                </button>
                            </div>
                        )}
                    </>
                )}

                {!isLoading && hasFetched && !items.length && (
                    <div id="noResults" className="no-results space-y-3">
                        <p>{t("noResults")}</p>
                        <p>
                            <span className="mr-2">{t("suggestWordCta")}</span>
                            <a
                                href={`/suggest${searchValue ? `?value=${encodeURIComponent(searchValue)}` : ""}`}
                                className="inline-block px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-all shadow-sm text-sm"
                            >
                                {t("suggestWordButton")}
                            </a>
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}