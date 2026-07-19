'use client';
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {isvToCyr, standardToSimple} from "@/lib/isv";
import {mapNslToEtymologized} from "@/lib/nsl";
import {useTranslations} from "next-intl";
import {saveScriptPreference} from "@/app/settings/actions";
import BookmarkButton from "@/components/BookmarkButton";
import {ScriptMode} from "@/lib/script-mode";

import "./main-page.css";

const LANGUAGE_CODES = ["ru", "en", "uk", "be", "bg", "hr", "sr", "mk", "sl", "pl", "cs", "sk", "de", "hsb", "dsb"];

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

const WordCard = ({ item, onClickCard, currentScript, toValue}: { item: any; onClickCard: any; currentScript: ScriptMode; toValue: string }) => {
    const lexeme = item;
    const wordValue = lexeme?.word?.value || lexeme?.value;
    const cyrillicVariant = isvToCyr(wordValue);
    const latinVariant = wordValue.toLowerCase();
    const title = useMemo(() => {
        if (currentScript === ScriptMode.CYRILLIC) {
            return `${cyrillicVariant} (${latinVariant})`
        }
        return `${latinVariant} (${cyrillicVariant})`;
    }, [currentScript, cyrillicVariant, latinVariant]);

    return (
        <li
            className="card"
            onClick={onClickCard(item)}
        >
            <div className="card-title">{title}</div>
            <div className="card-meta">{toValue === "is"
                ? `${item.pos} (${item.mainCategory})`
                : `${item.target?.pos} (${item.target?.mainCategory})`}</div>
            <div className="card-desc">{item.target?.value}</div>
            <div className="absolute top-2 right-2">
                <BookmarkButton wordId={item.id} />
            </div>
        </li>
    );
}

export default function Home({ currentScript, isGuest }: { currentScript: ScriptMode; isGuest?: boolean; }) {
    const t = useTranslations("translate");
    const [fromValue, setFromValue] = useState("ru");

    const languageOptions = useMemo(() =>
        LANGUAGE_CODES.map(code => (
            <option key={code} value={code}>{t(`languages.${code}`)}</option>
        )),
        [t]
    );
    const [toValue, setToValue] = useState("is");
    const [searchValue, setSearchValue] = useState("");
    const [mainCategory, setMainCategory] = useState("");
    const [usageType, setUsageType] = useState("");
    const [formScript, setFormScript] = useState<ScriptMode>(currentScript);
    const [items, setItems] = useState<Array<any>>([]);
    const [hasFetched, setHasFetched] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [filtersVisible, setFiltersVisible] = useState(true);

    const router = useRouter();
    const searchParams = useSearchParams();

    const searchInputRef = useRef<HTMLInputElement>(null);

    const performSearch = useCallback((query: string, from: string, to: string, mc: string, ut: string) => {
        setIsLoading(true);
        setVisibleCount(PAGE_SIZE);
        const sValue = from === "is" && /[а-яА-ЯёЁ]/.test(query)
            ? standardToSimple(mapNslToEtymologized(query))
            : query;

        const params = new URLSearchParams({ search: sValue, from, to });
        if (mc) params.set('mainCategory', mc);
        if (ut) params.set('usageType', ut);
        fetch(`/api/dict?${params}`)
            .then(res => res.json())
            .then((data) => {
                setItems(data);
                setHasFetched(true);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const executeSearch = useCallback(() => {
        performSearch(searchValue, fromValue, toValue, mainCategory, usageType);
        const params = new URLSearchParams({
            q: searchValue,
            from: fromValue,
            to: toValue,
        });
        if (mainCategory) params.set('mainCategory', mainCategory);
        if (usageType) params.set('usageType', usageType);
        router.replace(`/translate?${params}`);
        setFiltersVisible(false);
    }, [searchValue, fromValue, toValue, mainCategory, usageType, performSearch, router]);

    useEffect(() => {
        const q = searchParams.get('q');
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const mc = searchParams.get('mainCategory') || '';
        const ut = searchParams.get('usageType') || '';
        if (q) {
            setSearchValue(q);
            if (from) setFromValue(from);
            if (to) setToValue(to);
            setMainCategory(mc);
            setUsageType(ut);
            const detectedScript = /[а-яА-ЯёЁ]/.test(q) ? ScriptMode.CYRILLIC : ScriptMode.LATIN;
            setFormScript(detectedScript);
            performSearch(q, from || "ru", to || "is", mc, ut);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onSwitchClick = useCallback(() => {
        setFromValue(toValue);
        setToValue(fromValue);
    }, [fromValue, toValue]);

    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter" && searchValue.trim()) {
            executeSearch();
        }
    }, [executeSearch, searchValue]);

    const onClickCard = useCallback((item) => () => {
        router.push(`/words/${item.id}`);
    }, [router]);

    const onChangeSearch = useCallback((e) => {
        const newSearch = e.target.value;
        setSearchValue(newSearch);
    }, []);

    const onChangeFrom = useCallback((e) => {
        const newFrom = e.target.value;
        setFromValue(newFrom);
    }, []);

    const onChangeTo = useCallback((e) => {
        const newTo = e.target.value;
        setToValue(newTo);
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
                <div className="select-group flex items-center gap-2">
                    <select
                        id="sourceLang"
                        value={fromValue}
                        className="select-field disabled:opacity-50 disabled:cursor-not-allowed"
                        onChange={onChangeFrom}
                        disabled={fromValue === "is"}
                    >
                        {languageOptions}
                        {fromValue === "is" && (
                            <option value="is">{t("languages.is")}</option>
                        )}
                    </select>

                    <button
                        id="swapLanguages"
                        className="swap-btn inline-flex items-center justify-center p-2 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer"
                        title={t("swapTooltip")}
                        onClick={onSwitchClick}
                    >
                        <svg
                            className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                            xmlns="http://w3.org"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="2"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                        </svg>
                    </button>

                    <select
                        id="targetLang"
                        value={toValue}
                        className="select-field disabled:opacity-50 disabled:cursor-not-allowed"
                        onChange={onChangeTo}
                        disabled={toValue === "is"}
                    >
                        {languageOptions}
                        {toValue === "is" && (
                            <option value="is">{t("languages.is")}</option>
                        )}
                    </select>
                </div>

                <div className={`filter-row${filtersVisible ? '' : ' filter-row--collapsed'}`}>
                    <select
                        className="filter-select"
                        value={mainCategory}
                        onChange={e => setMainCategory(e.target.value)}
                    >
                        {Object.entries(MAIN_CATEGORY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <select
                        className="filter-select"
                        value={usageType}
                        onChange={e => setUsageType(e.target.value)}
                    >
                        {Object.entries(USAGE_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <button
                        className="script-switcher"
                        onClick={toggleScript}
                        title={formScript === ScriptMode.CYRILLIC ? "Преключи на латиницу" : "Преключи на кириллицу"}
                    >
                        {formScript === ScriptMode.CYRILLIC ? "Кир" : "Lat"}
                    </button>
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        id="searchInput"
                        className="search-box flex-1"
                        placeholder={t("searchPlaceholder")}
                        value={searchValue}
                        onKeyDown={onKeyDown}
                        onChange={onChangeSearch}
                        ref={searchInputRef}
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
                                    item={item}
                                    onClickCard={onClickCard}
                                    currentScript={formScript}
                                    toValue={toValue}
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
                    <div id="noResults" className="no-results">{t("noResults")}</div>
                )}
            </div>
        </>
    );
}