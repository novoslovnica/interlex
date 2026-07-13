'use client';
import React, { useRef, useEffect, useMemo, useState } from 'react';
import {useInfiniteQuery, useQueryClient} from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    ColumnDef, VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EditableCell } from './EditableCell';
import {EditableLanguageCell} from "@/app/admin/Table/EditableLanguageCell";
import Link from "next/link";

const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
    id: true,
    meaningText: true,
    nsl: true,
    isv: true,
    ru: true,
    en: false,
    mk: false,
    bg: false,
    sr: false,
    hr: false,
    pl: false,
    cs: false,
    sk: false,
    sl: false,
    de: false,
    uk: false,
    be: false,
    hsb: false,
    dsb: false,
    cu: false,
    nl: false,
    eo: false,
};

export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export default function InfiniteEditableTable({ initialColumnVisibility, onSaveColumnVisibility }: { initialColumnVisibility?: string | null, onSaveColumnVisibility: (json: string) => Promise<void> }) {
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterLang, setFilterLang] = useState('');
const [unverifiedOnly, setUnverifiedOnly] = useState(false);

    const debouncedSearch = useDebounce(searchQuery, 400);

    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
        if (initialColumnVisibility) {
            try {
                const saved = JSON.parse(initialColumnVisibility);
                return { ...DEFAULT_COLUMN_VISIBILITY, ...saved };
            } catch {
                return DEFAULT_COLUMN_VISIBILITY;
            }
        }
        return DEFAULT_COLUMN_VISIBILITY;
    });

    const columnVisibilityJson = JSON.stringify(columnVisibility);
    const debouncedColumnVisibility = useDebounce(columnVisibilityJson, 1000);

    useEffect(() => {
        if (debouncedColumnVisibility !== JSON.stringify(DEFAULT_COLUMN_VISIBILITY)) {
            onSaveColumnVisibility(debouncedColumnVisibility);
        }
    }, [debouncedColumnVisibility, onSaveColumnVisibility]);

    const LANG_OPTIONS = [
        { code: 'ru', label: 'Русский' },
        { code: 'en', label: 'Английский' },
        { code: 'mk', label: 'Македонский' },
        { code: 'bg', label: 'Болгарский' },
        { code: 'sr', label: 'Сербский' },
        { code: 'hr', label: 'Хорватский' },
        { code: 'pl', label: 'Польский' },
        { code: 'cs', label: 'Чешский' },
        { code: 'sk', label: 'Словацкий' },
        { code: 'sl', label: 'Словенский' },
        { code: 'de', label: 'Немецкий' },
        { code: 'uk', label: 'Украинский' },
        { code: 'be', label: 'Белорусский' },
        { code: 'hsb', label: 'Верхнелужицкий' },
        { code: 'dsb', label: 'Нижнелужицкий' },
        { code: 'cu', label: 'Церковнославянский' },
        { code: 'nl', label: 'Нидерландский' },
        { code: 'eo', label: 'Эсперанто' },
    ];

    const queryKey = useMemo(() => ['lexicon-infinite', debouncedSearch, filterLang, unverifiedOnly], [debouncedSearch, filterLang, unverifiedOnly]);

    const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
        useInfiniteQuery({
            queryKey,
            queryFn: async ({ pageParam = 0 }): Promise<{ data: any[]; nextOffset: number | null }> => {
                const params = new URLSearchParams();
                if (pageParam) params.append('offset', String(pageParam));
                params.append('limit', '30');

                if (debouncedSearch) {
                    params.append('search', debouncedSearch);
                }

                if (filterLang) {
                    params.append('filterLang', filterLang);
                    if (unverifiedOnly) {
                        params.append('unverified', '1');
                    }
                }

                const res = await fetch(`/api/lexicon?${params.toString()}`);
                const data = await res.json();

                return {
                    data,
                    nextOffset: pageParam + 30 < 30 ? pageParam + 30 : null,
                };
            },
            initialPageParam: 0,
            getNextPageParam: (lastPage, allPages) => {
                if (!lastPage || lastPage.data.length === 0) return undefined;
                return allPages.length * 30;
            },
            gcTime: 0,
        });

    const flatData = useMemo(
        () => {
            const pages = data?.pages ? data.pages.flatMap(page => page.data || []) : [];
            const seenLexemeIds = new Set<number>();
            return pages.map(row => {
                const isFirst = !seenLexemeIds.has(row.lexemeId);
                seenLexemeIds.add(row.lexemeId);
                return { ...row, _disabledLexemeFields: !isFirst };
            });
        }, [data]
    );

    const columns = useMemo<ColumnDef<any>[]>(
        () => [
            { accessorKey: 'id', header: 'ID', size: 50, cell: ({ getValue, row }) => (
                    <Link href={`/admin/words/${row.original.id}/edit`} className="text-blue-600 hover:underline font-mono">
                        {getValue<string>()}
                    </Link>
                ) },
            {
                id: "meaningText",
                accessorKey: 'meaningText',
                header: 'Значение',
                minSize: 200,
                cell: ({ getValue, row }) => {
                    const meaning = getValue<string>();
                    const examples = (row.original as any).examples as string | null;
                    const meaningId = (row.original as any).meaningId as number;
                    return (
                        <div className="px-2 py-1 truncate" title={meaning || ''}>
                            <span className="text-xs text-muted-foreground font-mono mr-1">#{meaningId}</span>
                            <span>{meaning || <span className="text-gray-300 italic">—</span>}</span>
                            {examples && <span className="text-[10px] text-gray-400 ml-1">📎</span>}
                        </div>
                    );
                },
            },
            {
                id: "nsl",
                accessorKey: 'nsl',
                header: 'Новословница (архив)',
                minSize: 200,
                cell: EditableCell,
            },
            {
                id: "isv",
                accessorKey: 'isv',
                header: 'Межславянский',
                cell: EditableCell,
            },
            {
                id: "value",
                accessorKey: 'value',
                header: 'Ключ поиска',
                cell: EditableCell,
            },
            {
                id: "en",
                accessorKey: 'en',
                header: 'Английский',
                cell: EditableLanguageCell,
            },
            {
                id: "ru",
                accessorKey: 'ru',
                header: 'Русский',
                cell: EditableLanguageCell,
            },
            {
                id: "sr",
                accessorKey: 'sr',
                header: 'Сербский',
                cell: EditableLanguageCell,
            },
            {
                id: "bg",
                accessorKey: 'bg',
                header: 'Болгарский',
                cell: EditableLanguageCell,
            },
            {
                id: "mk",
                accessorKey: 'mk',
                header: 'Македонский',
                cell: EditableLanguageCell,
            },
            {
                id: "cs",
                accessorKey: 'cs',
                header: 'Чешский',
                cell: EditableLanguageCell,
            },
            {
                id: "sk",
                accessorKey: 'sk',
                header: 'Словацкий',
                cell: EditableLanguageCell,
            },
            {
                id: "sl",
                accessorKey: 'sl',
                header: 'Словенский',
                cell: EditableLanguageCell,
            },
            {
                id: "hr",
                accessorKey: 'hr',
                header: 'Хорватский',
                cell: EditableLanguageCell,
            },
            {
                id: "de",
                accessorKey: 'de',
                header: 'Немецкий',
                cell: EditableLanguageCell,
            },
            {
                id: "uk",
                accessorKey: 'uk',
                header: 'Украинский',
                cell: EditableLanguageCell,
            },
            {
                id: "be",
                accessorKey: 'be',
                header: 'Белорусский',
                cell: EditableLanguageCell,
            },
            {
                id: "hsb",
                accessorKey: 'hsb',
                header: 'Верхнелужицкий',
                cell: EditableLanguageCell,
            },
            {
                id: "dsb",
                accessorKey: 'dsb',
                header: 'Нижнелужицкий',
                cell: EditableLanguageCell,
            },
            {
                id: "cu",
                accessorKey: 'cu',
                header: 'Церковнославянский',
                cell: EditableLanguageCell,
            },
            {
                id: "nl",
                accessorKey: 'nl',
                header: 'Нидерландский',
                cell: EditableLanguageCell,
            },
            {
                id: "eo",
                accessorKey: 'eo',
                header: 'Эсперанто',
                cell: EditableLanguageCell,
            },
        ],
        []
    );

    const table = useReactTable({
        data: flatData,
        columns,
        state: {
            columnVisibility
        },
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            updateData: (rowIndex: number, columnId: string, value: string) => {
                const targetRow = flatData[rowIndex];
                if (!targetRow) return;

                queryClient.setQueryData(queryKey, (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page: any) => ({
                            ...page,
                            data: page.data.map((row: any) =>
                                row.meaningId === targetRow.meaningId ? { ...row, [columnId]: value } : row
                            )
                        }))
                    };
                });
                if (["nsl", "isv", "value"].includes(columnId)) {
                    fetch(`/api/lexicon/${targetRow.id}/updateField`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            field: columnId,
                            newValue: value,
                        }),
                    })
                }
            },
            updateCellData: (rowIndex: number, columnId: string, value: unknown) => {
                const targetRow = flatData[rowIndex];
                if (!targetRow) return;

                queryClient.setQueryData(queryKey, (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page: any) => ({
                            ...page,
                            data: page.data.map((row: any) =>
                                row.meaningId === targetRow.meaningId ? { ...row, [columnId]: value } : row
                            )
                        }))
                    };
                });
            },
        },
    });

    const { rows } = table.getRowModel();

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 45,
        overscan: 5,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();

    useEffect(() => {
        if (virtualItems.length === 0) return;

        const lastItem = virtualItems[virtualItems.length - 1];

        if (
            lastItem.index >= rows.length - 5 &&
            hasNextPage &&
            !isFetchingNextPage
        ) {
            fetchNextPage();
        }
    }, [virtualItems, hasNextPage, isFetchingNextPage, rows.length, fetchNextPage]);

    return (
        <div className="flex flex-col gap-2 p-4 w-full">
            <div className="flex flex-row gap-2 w-full">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Поиск по всем языкам..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full border border-border rounded-lg px-4 py-2 text-sm bg-background text-foreground outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-10"
                    />
                    {isFetching && !isFetchingNextPage && (
                        <div className="absolute right-3 top-2.5 text-xs text-muted-foreground animate-pulse">
                            🔍
                        </div>
                    )}
                </div>

                <Link
                    href="/admin/words/create"
                    className="inline-flex items-center justify-center shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                    <svg
                        className="mr-2 h-4 w-4"
                        xmlns="http://w3.org"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Создать словарную статью
                </Link>
            </div>


            <div className="bg-muted/20 p-4 rounded-xl border space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-muted-foreground">Язык фильтра:</label>
                        <select
                            value={filterLang}
                            onChange={(e) => setFilterLang(e.target.value)}
                            className="border border-border rounded px-2 py-1 text-xs bg-background text-foreground outline-none focus:border-blue-500"
                        >
                            <option value="">— не выбран —</option>
                            {LANG_OPTIONS.map(lang => (
                                <option key={lang.code} value={lang.code}>{lang.label}</option>
                            ))}
                        </select>
                    </div>
                    {filterLang && (
                        <label className="flex items-center gap-1.5 text-xs bg-background border border-border rounded px-3 py-1 cursor-pointer select-none hover:border-blue-500 transition-colors">
                            <input
                                type="checkbox"
                                checked={unverifiedOnly}
                                onChange={(e) => setUnverifiedOnly(e.target.checked)}
                                className="rounded border text-blue-600 focus:ring-blue-500"
                            />
                            <span>Только непроверенные ({LANG_OPTIONS.find(l => l.code === filterLang)?.label})</span>
                        </label>
                    )}
                </div>

                <span className="text-xs font-semibold text-muted-foreground block">Отображаемые языки (колонки):</span>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => table.toggleAllColumnsVisible(true)}
                        className="text-xs bg-background border border-border rounded px-2 py-1 hover:bg-muted/50"
                    >
                        Показать все
                    </button>

                    {table.getAllLeafColumns().map(column => {
                        if (column.id === 'id') return null;

                        return (
                            <label
                                key={column.id}
                                className="flex items-center gap-1.5 text-sm bg-background border border-border rounded px-3 py-1 cursor-pointer select-none hover:border-blue-500 transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={column.getIsVisible()}
                                    onChange={column.getToggleVisibilityHandler()}
                                    className="rounded border text-blue-600 focus:ring-blue-500"
                                />
                                <span>{column.columnDef.header as string}</span>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div
                ref={tableContainerRef}
                className="overflow-auto border border-border rounded-xl max-h-[500px] w-full relative bg-background shadow-sm"
            >
                <table className="min-w-full border-collapse text-left text-sm text-muted-foreground table-fixed">

                    <thead className="sticky top-0 bg-muted z-10 font-medium text-foreground border-b">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id} className="flex w-full">
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    className="p-3 font-semibold truncate"
                                    style={{
                                        width: header.getSize(),
                                        flex: `0 0 ${header.getSize()}px`
                                    }}
                                >
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                    </thead>


                    <tbody
                        className="relative block"
                        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                    >
                    {isFetching && !isFetchingNextPage && flatData.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                                <span className="animate-pulse">Ищем совпадения в базе данных...</span>
                            </td>
                        </tr>
                    ) : flatData.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="p-4 text-center text-muted-foreground">
                                Ничего не найдено
                            </td>
                        </tr>
                    ) : (
                        <>
                    {virtualItems.map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        return (
                            <tr
                                key={row.id}
                                className="absolute left-0 w-full hover:bg-muted/10 border-b flex items-center"
                                style={{
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td
                                        key={cell.id}
                                        className="p-2 truncate"
                                        style={{
                                            width: cell.column.getSize(),
                                            flex: `0 0 ${cell.column.getSize()}px`
                                        }}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                        </>
                    )}
                    </tbody>
                </table>
            </div>

            {isFetching && <div className="text-center text-sm text-muted-foreground">Загрузка...</div>}
        </div>
    );
}