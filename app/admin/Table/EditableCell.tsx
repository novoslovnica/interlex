import { useState, useEffect, ChangeEvent } from 'react';
import { Cell, Row, Table } from '@tanstack/react-table';

interface EditableCellProps<TData> {
    cell: Cell<TData, unknown>;
    row: Row<TData>;
    column: any;
    table: Table<TData>;
}

export function EditableCell<TData>({ cell, row, column, table }: EditableCellProps<TData>) {
    const initialValue = cell.getValue() as string;
    const [value, setValue] = useState(initialValue);

    // Синхронизируем внутренний стейт, если внешние данные обновились
    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const onChange = (e: ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
    };

    const onBlur = () => {
        // Вызываем метод обновления данных из meta-свойств таблицы
        (table.options.meta as any)?.updateData(row.index, column.id, value);
    };

    return (
        <input
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            className="w-full bg-transparent px-2 py-1 border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white outline-none rounded transition"
        />
    );
}
