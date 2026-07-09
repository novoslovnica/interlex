'use client';
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {isvToCyr, standardToSimple} from "@/lib/isv";
import {mapNslToEtymologized} from "@/lib/nsl";

import "./main-page.css";

const options = [
    <option key="ru" value="ru">Русский</option>,
    <option key="en" value="en">English</option>,
    <option key="uk" value="uk">Украинский</option>,
    <option key="be" value="be">Беларускы</option>,
    <option key="bg" value="gb">Български</option>,
    <option key="hr" value="hr">Хрватски</option>,
    <option key="sr" value="sr">Српски</option>,
    <option key="mk" value="mk">Македонски</option>,
    <option key="sl" value="sl">Словенский</option>,
    <option key="pl" value="pl">Польский</option>,
    <option key="cs" value="cs">Чешский</option>,
    <option key="sk" value="sk">Словацкий</option>,
    <option key="de" value="de">Deutsch</option>,
    <option key="hsb" value="hsb">Hornjoserbsce</option>,
    <option key="dsb" value="dsb">Dolnoserbski</option>,
];

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

const WordCard = ({ item, onClickCard, currentScript, toValue}: any) => {
    const cyrillicVariant = isvToCyr(item.value);
    const latinVariant = item.value.toLowerCase();
    const title = useMemo(() => {
        if (currentScript === "CYRILLIC") {
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
            <div className="card-meta">{toValue === "is"
                ? `${item.pos} (${item.mainCategory})`
                : `${item.target?.pos} (${item.target?.mainCategory})`}</div>
            <div className="card-desc">{item.target?.value}</div>
        </li>
    );
}

export default function Home({ currentScript, isGuest }: { currentScript: string; isGuest?: boolean; }) {
    const [fromValue, setFromValue] = useState("ru");
    const [toValue, setToValue] = useState("is");
    const [searchValue, setSearchValue] = useState("");
    const [mainCategory, setMainCategory] = useState("");
    const [usageType, setUsageType] = useState("");
    const [formScript, setFormScript] = useState(currentScript);
    const [items, setItems] = useState<Array<any>>([]);
    const [hasFetched, setHasFetched] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();

    const performSearch = useCallback((query: string, from: string, to: string, mc: string, ut: string) => {
        const sValue = from === "is"
            ? formScript === "CYRILLIC"
                ? standardToSimple(mapNslToEtymologized(query))
                : query
            : query;

        const params = new URLSearchParams({ search: sValue, from, to });
        if (mc) params.set('mainCategory', mc);
        if (ut) params.set('usageType', ut);
        fetch(`/api/dict?${params}`)
            .then(res => res.json())
            .then((data) => {
                setItems(data);
                setHasFetched(true);
            });
    }, [formScript]);

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
            performSearch(q, from || "ru", to || "is", mc, ut);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onSwitchClick = useCallback(() => {
        setFromValue(toValue);
        setToValue(fromValue);
    }, [fromValue, toValue]);

    const onKeyDown = useCallback((e) => {
        if (e.key === "Enter") {
            performSearch(searchValue, fromValue, toValue, mainCategory, usageType);
            const params = new URLSearchParams({
                q: searchValue,
                from: fromValue,
                to: toValue,
            });
            if (mainCategory) params.set('mainCategory', mainCategory);
            if (usageType) params.set('usageType', usageType);
            router.replace(`/translate?${params}`);
        }
    }, [searchValue, fromValue, toValue, mainCategory, usageType, performSearch, router]);

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
        setFormScript(prev => prev === "CYRILLIC" ? "LATIN" : "CYRILLIC");
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
                        {[...options]}
                        {fromValue === "is" && (
                            <option value="is">Меджусловіанскы</option>
                        )}
                    </select>

                    <button
                        id="swapLanguages"
                        className="swap-btn inline-flex items-center justify-center p-2 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer"
                        title="Поменять языки местами"
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
                        {[...options]}
                        {toValue === "is" && (
                            <option value="is">Меджусловіанскы</option>
                        )}
                    </select>
                </div>

                <div className="filter-row">
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
                        title={formScript === "CYRILLIC" ? "Преключи на латиницу" : "Преключи на кириллицу"}
                    >
                        {formScript === "CYRILLIC" ? "Кир" : "Lat"}
                    </button>
                </div>

                <input
                    type="text"
                    id="searchInput"
                    className="search-box"
                    placeholder="Введите текст для поиска..."
                    value={searchValue}
                    onKeyDown={onKeyDown}
                    onChange={onChangeSearch}
                />

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
                        <span>
                            При переводе с междуславянского локаль автоматически подстроена под локаль вашего браузера.
                        </span>
                    </div>
                )}
            </div>

            <div className="scroll-container">
                {items.length > 0 && (
                    <ul id="cardGrid" className="card-grid">
                        {items.map((item) => (
                            <WordCard
                                key={item.id}
                                item={item}
                                onClickCard={onClickCard}
                                currentScript={formScript}
                                toValue={toValue}
                            />
                        ))}
                    </ul>
                )}

                {hasFetched && !items.length && (
                    <div id="noResults" className="no-results">Ничего не найдено</div>
                )}
            </div>
        </>
    );
}