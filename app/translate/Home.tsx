'use client';
import React, {useCallback, useMemo} from "react";
import {useRouter} from "next/navigation";
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
];

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
                ? `${item.pos} (${item.field})`
                : `${item.target?.pos} (${item.target?.field})`}</div>
            <div className="card-desc">{item.target?.value}</div>
        </li>
    );
}

export default function Home({ currentScript, isGuest }: { currentScript: string; isGuest?: boolean; }) {
    const [fromValue, setFromValue] = React.useState("ru");
    const [toValue, setToValue] = React.useState("is");
    const [searchValue, setSearchValue] = React.useState("");
    const [items, setItems] = React.useState<Array<any>>([]);
    const [hasFetched, setHasFetched] = React.useState(false);

    const onSwitchClick = useCallback(() => {
        setFromValue(toValue);
        setToValue(fromValue);
    }, [fromValue, toValue]);

    const onKeyDown = useCallback((e) => {
        if (e.key === "Enter") {
            const sValue = fromValue === "is"
                ? currentScript === "CYRILLIC"
                    ? standardToSimple(mapNslToEtymologized(searchValue))
                    : searchValue
                : searchValue;

            fetch(`/api/dict?search=${sValue}&from=${fromValue}&to=${toValue}`)
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

    const onChangeFrom = useCallback((e) => {
        const newFrom = e.target.value;
        setFromValue(newFrom);
    }, []);

    const onChangeTo = useCallback((e) => {
        const newTo = e.target.value;
        setToValue(newTo);
    }, []);

    return (
        <>
            <div className="search-container">
                {/* Контейнер элементов выбора языков */}
                <div className="select-group flex items-center gap-2">
                    {/* Исходный язык */}
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

                    {/* Кнопка смены направления с SVG иконкой */}
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

                    {/* Целевой язык */}
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
                                item={item}
                                onClickCard={onClickCard}
                                currentScript={currentScript}
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
