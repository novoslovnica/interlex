'use client';
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {isvToCyr, standardToSimple} from "@/lib/isv";
import {mapNslToEtymologized} from "@/lib/nsl";

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

const WordCard = ({ onClickCard, item, currentScript }: any) => {
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
            <div className="card-meta">{`${item.pos}`}</div>
            <div className="card-desc">{item.target?.value}</div>
        </li>
    )
}

export default function Home({ currentScript, isGuest }: { currentScript: string; isGuest?: boolean; }) {
    const [searchValue, setSearchValue] = useState("");
    const [mainCategory, setMainCategory] = useState("");
    const [usageType, setUsageType] = useState("");
    const [formScript, setFormScript] = useState(currentScript);
    const [items, setItems] = useState<Array<any>>([]);
    const [hasFetched, setHasFetched] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();

    const performSearch = useCallback((query: string, mc: string, ut: string) => {
        const params = new URLSearchParams({ search: query, limit: '50', offset: '0' });
        if (mc) params.set('mainCategory', mc);
        if (ut) params.set('usageType', ut);
        fetch(`/api/lexicon?${params}`)
            .then(res => res.json())
            .then((data) => {
                setItems(data);
                setHasFetched(true);
            });
    }, []);

    useEffect(() => {
        const q = searchParams.get('q');
        const mc = searchParams.get('mainCategory') || '';
        const ut = searchParams.get('usageType') || '';
        if (q) {
            setSearchValue(q);
            setMainCategory(mc);
            setUsageType(ut);
            performSearch(q, mc, ut);
        }
    }, []);

    const onKeyDown = useCallback((e) => {
        if (e.key === "Enter") {
            const sValue = formScript === "CYRILLIC"
                    ? standardToSimple(mapNslToEtymologized(searchValue))
                    : searchValue;

            const params = new URLSearchParams({ q: sValue });
            if (mainCategory) params.set('mainCategory', mainCategory);
            if (usageType) params.set('usageType', usageType);
            performSearch(sValue, mainCategory, usageType);
            router.replace(`/lexicon?${params}`);
        }
    }, [searchValue, mainCategory, usageType, formScript, performSearch, router]);

    const onClickCard = useCallback((item) => () => {
        router.push(`/words/${item.id}`);
    }, [router]);

    const onChangeSearch = useCallback((e) => {
        setSearchValue(e.target.value);
    }, []);

    const toggleScript = useCallback(() => {
        setFormScript(prev => prev === "CYRILLIC" ? "LATIN" : "CYRILLIC");
    }, []);

    return (
        <>
            <div className="search-container">
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
                                onClickCard={onClickCard}
                                item={item}
                                currentScript={formScript}
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