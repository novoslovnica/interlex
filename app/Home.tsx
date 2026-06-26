'use client';
import React, {useCallback, useEffect} from "react";
import "./main-page.css";
import {useRouter} from "next/navigation";
import {standardToSimple} from "@/lib/isv";
import {mapNslToEtymologized} from "@/lib/nsl";
import TelegramLogin from "@/components/TelegramLogin";
import {signIn} from "@/auth";

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

export default function Home() {
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
                ? standardToSimple(mapNslToEtymologized(searchValue))
                : searchValue;

            fetch(`/api/dict?search=${sValue}&from=${fromValue}&to=${toValue}`)
                .then(res => res.json())
                .then((data) => {
                setItems(data);
            });
        }
    }, [searchValue]);

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
                <div className="select-group">
                    <TelegramLogin />
                    <select
                        id="sourceLang"
                        value={fromValue}
                        className="select-field"
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
                        className="swap-btn"
                        title="Поменять языки местами"
                        onClick={onSwitchClick}
                    >⇄</button>

                    <select
                        id="targetLang"
                        value={toValue}
                        className="select-field"
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
            </div>
            <div className="scroll-container">

                {items.length > 0 && (
                    <ul id="cardGrid" className="card-grid">
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className="card"
                                onClick={onClickCard(item)}
                            >
                                <div className="card-title">{item.nsl} / {item.value}</div>
                                <div className="card-meta">{toValue === "is"
                                    ? `${item.pos} (${item.field})`
                                    : `${item.target?.pos} (${item.target?.field})`}</div>
                                <div className="card-desc">{item.target?.value}</div>
                            </li>
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
