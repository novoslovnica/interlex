"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import type { LexiconSuggestion } from "@/app/api/lexicon/services";
import { writeOrTranslate, type ScriptMode } from "@/lib/script-mode";

interface Props {
    inputRef: RefObject<HTMLInputElement | null>;
    value: string;
    onChange: (value: string) => void;
    onSearch: () => void;
    reverse: boolean;
    category: string;
    usage: string;
    script: ScriptMode;
}

export default function LexiconSearchInput({inputRef, value, onChange, onSearch, reverse, category, usage, script}: Props) {
    const t = useTranslations("lexicon");
    const router = useRouter();
    const listId = useId();
    const listRef = useRef<HTMLUListElement>(null);
    const [focused, setFocused] = useState(false);
    const [composing, setComposing] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [result, setResult] = useState<{key: string; items: LexiconSuggestion[]} | null>(null);
    const query = value.trim();
    const enabled = !reverse && focused && !composing && query.length > 0 && query.length <= 100;
    const key = new URLSearchParams({q: query, mainCategory: category, usageType: usage}).toString();
    const suggestions = enabled && result?.key === key ? result.items : [];
    const expanded = !dismissed && suggestions.length > 0;
    const activeItem = expanded && selectedIndex !== null ? suggestions[selectedIndex] : undefined;

    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch(`/api/lexicon/suggestions?${key}`, {signal: controller.signal});
                if (!response.ok) throw new Error("Could not load lexicon suggestions");
                const items: LexiconSuggestion[] = await response.json();
                if (!controller.signal.aborted) setResult({key, items});
            } catch {
                if (!controller.signal.aborted) setResult({key, items: []});
            }
        }, 200);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [enabled, key]);

    useEffect(() => {
        if (expanded && selectedIndex !== null) {
            listRef.current?.children[selectedIndex]?.scrollIntoView({block: "nearest"});
        }
    }, [expanded, selectedIndex]);

    function dismiss() {
        setDismissed(true);
        setSelectedIndex(null);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.nativeEvent.isComposing || composing) return;

        if (event.key === "Escape" && enabled && !dismissed) {
            event.preventDefault();
            dismiss();
        }
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length > 0) {
            event.preventDefault();
            setDismissed(false);
            const direction = event.key === "ArrowDown" ? 1 : -1;
            setSelectedIndex(previous => {
                if (!expanded || previous === null) return direction === 1 ? 0 : suggestions.length - 1;
                return (previous + direction + suggestions.length) % suggestions.length;
            });
        }
        if (event.key === "Enter" && query) {
            event.preventDefault();
            dismiss();
            if (activeItem) router.push(`/words/${activeItem.id}`);
            else onSearch();
        }
    }

    return (
        <div className="min-w-0 flex-1">
            <input
                type="text"
                id="searchInput"
                ref={inputRef}
                className="search-box"
                placeholder={t(reverse ? "reversePlaceholder" : "searchPlaceholder")}
                aria-label={t(reverse ? "reversePlaceholder" : "searchLabel")}
                autoComplete="off"
                role={reverse ? undefined : "combobox"}
                aria-autocomplete={reverse ? undefined : "list"}
                aria-expanded={reverse ? undefined : expanded}
                aria-controls={expanded ? listId : undefined}
                aria-activedescendant={activeItem ? `${listId}-${activeItem.id}` : undefined}
                value={value}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    setFocused(true);
                    setDismissed(false);
                }}
                onBlur={() => {
                    setFocused(false);
                    dismiss();
                }}
                onChange={event => {
                    setSelectedIndex(null);
                    setDismissed(false);
                    onChange(event.target.value);
                }}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={() => setComposing(false)}
            />
            {expanded && (
                <ul
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    aria-label={t("searchSuggestions")}
                    className="absolute inset-x-0 top-full z-20 mt-1 max-h-[min(16rem,35dvh)] overflow-y-auto rounded-lg border bg-background p-1 text-foreground shadow-lg"
                >
                    {suggestions.map(item => (
                        <li key={item.id} id={`${listId}-${item.id}`} role="option" aria-selected={activeItem?.id === item.id}>
                            <Link
                                href={`/words/${item.id}`}
                                tabIndex={-1}
                                prefetch={false}
                                className={`flex items-baseline justify-between gap-3 rounded-md px-3 py-2 text-sm ${activeItem?.id === item.id ? "bg-primary text-primary-foreground dark:bg-blue-700" : "hover:bg-muted"}`}
                                onMouseDown={event => event.preventDefault()}
                                onClick={dismiss}
                            >
                                <span className="min-w-0 break-words font-medium" lang="isv">{writeOrTranslate(item.value, script)}</span>
                                {item.pos && <span className="shrink-0 text-xs">{item.pos}</span>}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
