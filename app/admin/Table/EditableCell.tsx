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

    const disabled = (row.original as any)?._disabledLexemeFields === true;

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const onChange = (e: ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
    };

    const onSave = () => {
        (table.options.meta as any)?.updateData(row.index, column.id, value);
    };

    if (disabled) {
        return (
            <span className="block px-2 py-1 text-gray-400 italic truncate">
                {value || '—'}
            </span>
        );
    }

    return (
        <input
            value={value}
            onChange={onChange}
            onBlur={onSave}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    onSave();
                    (e.target as HTMLInputElement).blur();
                }
            }}
            className="w-full bg-transparent px-2 py-1 border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white outline-none rounded transition"
        />
    );
}