'use client';
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EditableCell } from './EditableCell';

// Интерфейс структуры данных
interface RowData {
    id: string;
    name: string;
    status: string;
}

// Имитация API запроса к серверу Next.js
const fetchPage = async ({ pageParam = 0 }): Promise<{ data: RowData[]; nextOffset: number | null }> => {
    console.log(pageParam);
    const res = await fetch(`/api/lexicon?offset=${pageParam}`);
    const limit = 50;
    const data = await res.json();

    return {
        data,
        nextOffset: pageParam + limit < 50 ? pageParam + limit : null, // Ограничим 150 элементами для примера
    };
};

export default function InfiniteEditableTable() {
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // 1. Бесконечная загрузка данных с TanStack Query
    const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
        useInfiniteQuery({
            queryKey: ['table-data'],
            queryFn: fetchPage,
            initialPageParam: 0,
            getNextPageParam: (lastPage, allPages) => {
                if (!lastPage || lastPage.data.length === 0) return undefined;
                return allPages.length * 30;
            },
        });

    // Преобразуем paginated данные в плоский массив для таблицы
    const flatData = useMemo(
        () => data?.pages.flatMap((page) => page.data) ?? [],
        [data]
    );

    // Локальный стейт для измененных данных (на проде изменения обычно шлют на бэкенд через патч-запросы)
    const [tableData, setTableData] = useState<RowData[]>([]);

    useEffect(() => {
        if (flatData.length > 0 && tableData.length === 0) {
            setTableData(flatData);
        } else if (flatData.length > tableData.length) {
            // Дописываем новые страницы в локальный стейт при доскролле
            setTableData((prev) => [...prev, ...flatData.slice(prev.length)]);
        }
    }, [flatData]);

    // 2. Определение колонок
    const columns = useMemo<ColumnDef<RowData>[]>(
        () => [
            { accessorKey: 'id', header: 'ID', size: 50 },
            {
                accessorKey: 'nsl',
                header: 'Новословница (архив)',
                minSize: 200,
                cell: EditableCell, // Используем наш кастомный инпут
            },
            {
                accessorKey: 'isv',
                header: 'Межславянский',
                cell: EditableCell,
            },
            {
                accessorKey: 'value',
                header: 'Ключ поиска',
                cell: EditableCell,
            },
            {
                accessorKey: 'en',
                header: 'Английский',
                cell: EditableCell,
            },
            {
                accessorKey: 'ru',
                header: 'Русский',
                cell: EditableCell,
            },
            {
                accessorKey: 'sr',
                header: 'Сербский',
                cell: EditableCell,
            },
            {
                accessorKey: 'bg',
                header: 'Болгарский',
                cell: EditableCell,
            },
            {
                accessorKey: 'mk',
                header: 'Македонский',
                cell: EditableCell,
            },
            {
                accessorKey: 'pl',
                header: 'Польский',
                cell: EditableCell,
            },
        ],
        []
    );

    // 3. Инициализация TanStack Table
    const table = useReactTable({
        data: tableData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            updateData: (rowIndex: number, columnId: string, value: string) => {
                setTableData((old) =>
                    old.map((row, index) => {
                        if (index === rowIndex) {
                            return {
                                ...old[rowIndex]!,
                                [columnId]: value,
                            };
                        }
                        return row;
                    })
                );
                console.log(`Обновлено: строка ${rowIndex}, колонка ${columnId} -> значение: ${value}`);
                // Здесь можно вызвать mutation для отправки на сервер (например, useMutation / fetch PATCH)
            },
        },
    });

    const { rows } = table.getRowModel();

    // 4. Виртуализация строк с @tanstack/react-virtual
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 45, // Ожидаемая высота строки в пикселях
        overscan: 5, // Сколько строк рендерить за пределами видимости
    });

    // 5. Триггер загрузки следующей страницы при бесконечном скролле
    const virtualItems = rowVirtualizer.getVirtualItems();

    useEffect(() => {
        if (virtualItems.length === 0) return;

        const lastItem = virtualItems[virtualItems.length - 1];

        // Если пользователь приблизился к концу загруженного списка, запрашиваем еще
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
            <div
                ref={tableContainerRef}
                className="overflow-auto border border-gray-200 rounded-md max-h-[500px] w-full relative bg-white"
            >
                <table className="min-w-full border-collapse text-left text-sm text-gray-500 table-fixed">

                    <thead className="sticky top-0 bg-gray-100 z-10 font-medium text-gray-700 border-b border-gray-200">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id} className="flex w-full">
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    className="p-3 font-semibold truncate"
                                    style={{
                                        width: header.getSize(),
                                        flex: `0 0 ${header.getSize()}px` // Запрещает флекс-элементу сжиматься
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
                    {virtualItems.map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        return (
                            <tr
                                key={row.id}
                                className="absolute left-0 w-full hover:bg-gray-50 border-b border-gray-100 flex items-center"
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
                                            flex: `0 0 ${cell.column.getSize()}px` // Гарантирует сохранение ширины колонки
                                        }}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>

            {isFetching && <div className="text-center text-sm text-gray-500">Загрузка...</div>}
        </div>
    );
}
