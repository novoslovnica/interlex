'use client';
import React, {useCallback, useEffect, useRef, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import Link from "next/link";
import {isvToCyr, standardToSimple} from "@/lib/isv";
import {mapNslToEtymologized} from "@/lib/nsl";
import {useTranslations} from "next-intl";
import {saveScriptPreference} from "@/app/settings/actions";
import BookmarkButton from "@/components/BookmarkButton";
import DiacriticsHelper from "@/components/DiacriticsHelper";
import LexiconSearchInput from "./LexiconSearchInput";
import {ScriptMode} from "@/lib/script-mode";
import type {LexiconItem} from "@/app/api/lexicon/services";
import {TRANSLATION_LANGUAGES} from "@/config/features";
import {ALL_MAIN_CATEGORIES} from "@/lib/enums/MainCategory";

import "./main-page.css";

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

const WordCard = ({ item, currentScript }: { item: LexiconItem; currentScript: ScriptMode }) => {
    const wordValue = item.word?.value || item.value || "";
    const cyrillicVariant = isvToCyr(wordValue);
    const latinVariant = wordValue.toLowerCase();
    const title = currentScript === ScriptMode.CYRILLIC
        ? `${cyrillicVariant} (${latinVariant})`
        : `${latinVariant} (${cyrillicVariant})`;

    return (
        <li className="card">
            <Link href={`/words/${item.id}`} prefetch={false} className="card-title block after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-primary">
                {title}
            </Link>
            <div className="card-meta">{`${item.pos}`}</div>
            <div className="card-desc">{item.meaningText}</div>
            <div className="absolute top-2 right-2 z-10">
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
    const [items, setItems] = useState<LexiconItem[]>([]);
    const [hasFetched, setHasFetched] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchError, setSearchError] = useState(false);
    const activeSearch = useRef<{query: string; mc: string; ut: string; lang: string} | null>(null);
    const searchRequest = useRef(0);
    const [filtersVisible, setFiltersVisible] = useState(true);

    const router = useRouter();
    const searchParams = useSearchParams();

    const searchInputRef = useRef<HTMLInputElement>(null);
    const reverseSelectRef = useRef<HTMLSelectElement>(null);

    const performSearch = useCallback(async (query: string, mc: string, ut: string, lang: string, offset = 0) => {
        const requestId = ++searchRequest.current;
        setSearchError(false);
        if (offset === 0) {
            activeSearch.current = {query, mc, ut, lang};
            setIsLoading(true);
            setIsLoadingMore(false);
            setItems([]);
            setHasMore(false);
        } else {
            setIsLoadingMore(true);
        }
        const params = new URLSearchParams({search: query, limit: String(PAGE_SIZE), offset: String(offset)});
        if (lang) params.set('lang', lang);
        else {
            if (mc) params.set('mainCategory', mc);
            if (ut) params.set('usageType', ut);
        }
        try {
            const response = await fetch(`${lang ? '/api/lexicon/reverse' : '/api/lexicon'}?${params}`);
            if (!response.ok) throw new Error('Lexicon search failed');
            const data: unknown = await response.json();
            if (!Array.isArray(data)) throw new Error('Invalid lexicon response');
            if (requestId !== searchRequest.current) return;
            const page = data as LexiconItem[];
            setItems(prev => offset === 0 ? page : [...prev, ...page]);
            setHasMore(page.length === PAGE_SIZE);
            setHasFetched(true);
        } catch {
            if (requestId === searchRequest.current) setSearchError(true);
        } finally {
            if (requestId === searchRequest.current) {
                setIsLoading(false);
                setIsLoadingMore(false);
            }
        }
    }, []);

    const loadMore = () => {
        const criteria = activeSearch.current;
        if (!criteria || isLoading || isLoadingMore) return;
        void performSearch(criteria.query, criteria.mc, criteria.ut, criteria.lang, items.length);
    };

    function submitSearch(category: string) {
        // Реверс-поиск идёт по натуральному языку (ru/en/...), а не по ISV —
        // кириллическую/этимологическую нормализацию форм ISV к нему
        // применять не нужно.
        const sValue = !reverseLang && formScript === ScriptMode.CYRILLIC
            ? standardToSimple(mapNslToEtymologized(searchValue))
            : searchValue;

        const params = new URLSearchParams();
        if (searchValue) params.set('q', searchValue);
        if (category) params.set('mainCategory', category);
        if (usageType) params.set('usageType', usageType);
        if (reverseLang) params.set('lang', reverseLang);
        void performSearch(sValue, category, usageType, reverseLang);
        const query = params.toString();
        router.replace(query ? `/lexicon?${query}` : '/lexicon', {scroll: false});
    }

    function executeSearch() {
        submitSearch(mainCategory);
        setFiltersVisible(false);
    }

    useEffect(() => {
        const q = searchParams.get('q') || '';
        const mc = ALL_MAIN_CATEGORIES.find(category => category === searchParams.get('mainCategory')) || '';
        const ut = searchParams.get('usageType') || '';
        const lang = searchParams.get('lang') || '';
        if (q || (!lang && (mc || ut))) {
            setSearchValue(q);
            setMainCategory(mc);
            setUsageType(ut);
            setReverseLang(lang);
            if (lang) {
                performSearch(q, mc, ut, lang);
                return;
            }
            if (!q) {
                void performSearch('', mc, ut, '');
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
                <div id="lexicon-filters" inert={!filtersVisible} className={`filter-row${filtersVisible ? '' : ' filter-row--collapsed'}`}>
                    <select
                        className="filter-select"
                        value={mainCategory}
                        onChange={e => {
                            const category = e.target.value;
                            setMainCategory(category);
                            submitSearch(category);
                        }}
                        disabled={!!reverseLang}
                        aria-label={t("categoryLabel")}
                        title={reverseLang ? "Недоступно при реверс-поиске" : undefined}
                    >
                        <option value="">{t("categories.all")}</option>
                        {ALL_MAIN_CATEGORIES.map(category => (
                            <option key={category} value={category}>{t(`categories.${category}`)}</option>
                        ))}
                    </select>
                    <select
                        className="filter-select"
                        value={usageType}
                        onChange={e => setUsageType(e.target.value)}
                        disabled={!!reverseLang}
                        aria-label={t("usageLabel")}
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
                        aria-label={t(formScript === ScriptMode.CYRILLIC ? "toLatin" : "toCyrillic")}
                        disabled={!!reverseLang}
                    >
                        {formScript === ScriptMode.CYRILLIC ? "Кир" : "Lat"}
                    </button>
                    <select
                        ref={reverseSelectRef}
                        className="filter-select"
                        value={reverseLang}
                        onChange={e => setReverseLang(e.target.value)}
                        aria-label={t("directionLabel")}
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

                <div className="relative flex gap-2">
                    <LexiconSearchInput
                        inputRef={searchInputRef}
                        value={searchValue}
                        onChange={setSearchValue}
                        onSearch={executeSearch}
                        reverse={!!reverseLang}
                        category={mainCategory}
                        usage={usageType}
                        script={formScript}
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
                        aria-controls="lexicon-filters"
                        aria-expanded={filtersVisible}
                        aria-label={t(filtersVisible ? "hideFilters" : "showFilters")}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <button
                        className="search-btn"
                        onClick={executeSearch}
                        aria-label={t("searchLabel")}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                <Link href="/lexicon/topics" className="mt-3 inline-block text-sm font-medium text-primary dark:text-blue-400 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    {t("topics.title")}
                </Link>

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
                            {items.map((item) => (
                                <WordCard
                                    key={`${item.id}:${item.meaningId ?? "none"}`}
                                    item={item}
                                    currentScript={formScript}
                                />
                            ))}
                        </ul>
                        {hasMore && (
                            <div className="flex justify-center py-6">
                                <button
                                    onClick={loadMore}
                                    disabled={isLoadingMore}
                                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-all shadow-sm text-sm"
                                >
                                    {t(isLoadingMore ? "loading" : "loadMore")}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {searchError && <p role="alert" className="text-center py-4 text-red-600">{t("searchError")}</p>}

                {!isLoading && !searchError && hasFetched && !items.length && (
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
