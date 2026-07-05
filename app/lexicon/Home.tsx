'use client';
import React, {useCallback, useMemo} from "react";
import {useRouter} from "next/navigation";
import {isvToCyr, standardToSimple} from "@/lib/isv";
import {mapNslToEtymologized} from "@/lib/nsl";

import "./main-page.css";

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
    const [searchValue, setSearchValue] = React.useState("");
    const [items, setItems] = React.useState<Array<any>>([]);
    const [hasFetched, setHasFetched] = React.useState(false);

    const onKeyDown = useCallback((e) => {
        if (e.key === "Enter") {
            const sValue = currentScript === "CYRILLIC"
                    ? standardToSimple(mapNslToEtymologized(searchValue))
                    : searchValue;

            fetch(`/api/lexicon?search=${sValue}&limit=${50}&offset=${0}`)
                .then(res => res.json())
                .then((data) => {
                setItems(data);
            });
        }
    }, [searchValue, currentScript]);

    const navigate = useRouter();

    const onClickCard = useCallback((item) => () => {
        navigate.push(`/words/${item.id}`);
    }, []);

    const onChangeSearch = useCallback((e) => {
        const newSearch = e.target.value;
        setSearchValue(newSearch);
    }, []);

    return (
        <>
            <div className="search-container">
                <input
                    type="text"
                    id="searchInput"
                    className="search-box"
                    placeholder="Введите текст для поиска..."
                    value={searchValue}
                    onKeyDown={onKeyDown}
                    onChange={onChangeSearch}
                />

                {/* Уведомление о локали браузера (показывается только гостям, если isGuest === true) */}
                {isGuest && (
                    // Изменили text-blue-600 на text-muted-foreground (или text-gray-400) и добавили mt-2
                    <div className="flex items-center gap-1.5 px-1 mt-2 text-[11px] text-muted-foreground font-normal animate-fade-in">
                        {/* Маленькая иконка планеты — сделали её более серой через text-gray-400 */}
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
                                currentScript={currentScript}
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
