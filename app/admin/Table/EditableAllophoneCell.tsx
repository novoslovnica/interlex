import { useState, useEffect, ChangeEvent } from 'react';
import { Cell, Row, Table } from '@tanstack/react-table';

interface EditableAllophoneCellProps<TData> {
    cell: Cell<TData, unknown>;
    row: Row<TData>;
    column: any;
    table: Table<TData>;
}

export function EditableAllophoneCell<TData>({ cell, row, column, table }: EditableAllophoneCellProps<TData>) {
    const initialValue = cell.getValue() as string;
    const [value, setValue] = useState(initialValue);
    const [isHovering, setIsHovering] = useState(false);

    const verifiedField = `${column.id}Verified`;
    const [localVerified, setLocalVerified] = useState((row.original as any)[verifiedField] ?? null);

    const canEditWordsCore = (table.options.meta as any)?.canEditWordsCore !== false;
    const disabled = (row.original as any)?._disabledLexemeFields === true || !canEditWordsCore;

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    useEffect(() => {
        setLocalVerified((row.original as any)[verifiedField] ?? null);
    }, [(row.original as any)[verifiedField], verifiedField]);

    const onChange = (e: ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
    };

    const persist = (newValue: string, newVerified?: number) => {
        (table.options.meta as any)?.updateData(row.index, column.id, newValue, newVerified);
    };

    const onSave = () => {
        persist(value);
    };

    const updateVerification = (newVerified: number) => {
        setLocalVerified(newVerified);
        persist(value, newVerified);
    };

    const isVerified = localVerified === 1;

    if (disabled) {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1">
                <span
                    className={`shrink-0 text-xs ${isVerified ? 'text-green-500' : 'text-gray-400'}`}
                    title={isVerified ? 'Верифицировано' : 'Не верифицировано'}
                >
                    ●
                </span>
                <span className="text-gray-400 italic truncate">{value || '—'}</span>
            </div>
        );
    }

    return (
        <div
            className="flex items-center gap-1.5 px-2 py-1"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            <span
                className={`shrink-0 text-xs ${isVerified ? 'text-green-500' : 'text-gray-400'}`}
                title={isVerified ? 'Верифицировано' : 'Не верифицировано'}
            >
                ●
            </span>
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
                className="min-w-0 flex-1 bg-transparent px-1 py-0.5 border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white outline-none rounded transition"
            />
            {isHovering && (
                <span className="flex gap-0.5 shrink-0">
                    <button
                        onClick={() => updateVerification(isVerified ? 0 : 1)}
                        className="text-xs w-4 h-4 flex items-center justify-center rounded hover:bg-green-100 hover:text-green-700"
                        title={isVerified ? 'Снять верификацию' : 'Верифицировать'}
                    >
                        ✓
                    </button>
                    {isVerified && (
                        <button
                            onClick={() => updateVerification(0)}
                            className="text-xs w-4 h-4 flex items-center justify-center rounded hover:bg-red-100 hover:text-red-700"
                            title="Отклонить"
                        >
                            ✕
                        </button>
                    )}
                </span>
            )}
        </div>
    );
}
