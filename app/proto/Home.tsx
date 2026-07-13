'use client';
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import { useTranslations } from "next-intl";
import "./main-page.css";

interface ProtoWord {
    id: number;
    lemma: string;
    body: string;
    source_url: string;
}

const WordCard = ({onClickCard, item}: { onClickCard: (item: ProtoWord) => () => void; item: ProtoWord }) => {
    const displayLemma = `*${item.lemma}`;
    const preview = item.body
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);

    return (
        <li className="card" onClick={onClickCard(item)}>
            <div className="card-title">{displayLemma}</div>
            <div className="card-desc">{preview}{item.body.length > 200 ? '…' : ''}</div>
        </li>
    );
};

export default function Home({currentScript}: { currentScript: string; isGuest?: boolean }) {
    const t = useTranslations("proto");
    const [searchValue, setSearchValue] = useState("");
    const [items, setItems] = useState<ProtoWord[]>([]);
    const [hasFetched, setHasFetched] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();

    const performSearch = useCallback((query: string) => {
        fetch(`/api/proto?search=${encodeURIComponent(query)}&limit=50&offset=0`)
            .then(res => res.json())
            .then((data) => {
                setItems(data.items);
                setHasFetched(true);
            });
    }, []);

    useEffect(() => {
        const q = searchParams.get('q');
        if (q) {
            setSearchValue(q);
            performSearch(q);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            performSearch(searchValue);
            router.replace(`/proto?q=${encodeURIComponent(searchValue)}`);
        }
    }, [searchValue, performSearch, router]);

    const onClickCard = useCallback((item: ProtoWord) => () => {
        router.push(`/proto/${item.id}`);
    }, [router]);

    const onChangeSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchValue(e.target.value);
    }, []);

    return (
        <>
            <div className="search-container">
                <h1 className="text-xl font-bold text-slate-800 mb-4">{t("heading")}</h1>
                <input
                    type="text"
                    className="search-box"
                    placeholder={t("searchPlaceholder")}
                    value={searchValue}
                    onKeyDown={onKeyDown}
                    onChange={onChangeSearch}
                />
            </div>
            <div className="scroll-container">
                {items.length > 0 && (
                    <ul id="cardGrid" className="card-grid">
                        {items.map((item) => (
                            <WordCard key={item.id} onClickCard={onClickCard} item={item} />
                        ))}
                    </ul>
                )}
                {hasFetched && !items.length && (
                    <div id="noResults" className="no-results">{t("noResults")}</div>
                )}
            </div>
        </>
    );
}