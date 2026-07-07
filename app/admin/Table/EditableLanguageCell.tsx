import { useState, useEffect, ChangeEvent } from 'react';
import { CellContext } from '@tanstack/react-table';

interface LangObject {
    id: number;
    value: string | null;
    veryfied: number | null;
    wordId: number | null;
    meaningId: number | null;
}

export function EditableLanguageCell<TData>({ cell, row, column, table, getValue }: CellContext<any, LangObject>) {
    const langData = getValue();

    const [value, setValue] = useState(langData?.value || '');
    const [isEditing, setIsEditing] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [localVeryfied, setLocalVeryfied] = useState(langData?.veryfied ?? 0);

    useEffect(() => {
        setValue(langData?.value || '');
        setLocalVeryfied(langData?.veryfied ?? 0);
    }, [langData?.value, langData?.veryfied]);

    const onChange = (e: ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
    };

    const onSave = async () => {
        if (!langData?.id || value === langData.value) {
            setIsEditing(false);
            return;
        }

        try {
            const response = await fetch(`/api/lexicon/${langData.wordId}/updateField`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    field: column.id,
                    newValue: value,
                }),
            });

            if (!response.ok) throw new Error('Save failed');

            const updatedLangObject = await response.json();
            const tableMeta = table.options.meta as any;
            if (tableMeta?.updateCellData) {
                tableMeta.updateCellData(row.index, column.id, updatedLangObject);
            }
        } catch {
            setValue(langData?.value || '');
            alert('Не удалось сохранить изменения');
        }

        setIsEditing(false);
    };

    const updateVerification = async (newVeryfied: number) => {
        if (!langData?.wordId) return;

        try {
            const response = await fetch(`/api/lexicon/${langData.wordId}/updateField`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    field: column.id,
                    veryfied: newVeryfied,
                }),
            });

            if (!response.ok) throw new Error('Verification failed');

            setLocalVeryfied(newVeryfied);

            const tableMeta = table.options.meta as any;
            if (tableMeta?.updateCellData) {
                tableMeta.updateCellData(row.index, column.id, {
                    ...langData,
                    veryfied: newVeryfied,
                });
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (isEditing) {
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
                autoFocus
                className="w-full bg-transparent px-2 py-1 border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white outline-none rounded transition"
            />
        );
    }

    const isVerified = localVeryfied === 1;
    const displayText = langData?.value || '';

    return (
        <div
            className="flex items-center gap-1 px-2 py-1 relative cursor-text"
            onClick={() => setIsEditing(true)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            <span className={`shrink-0 text-xs ${isVerified ? 'text-green-500' : 'text-gray-400'}`}>
                ●
            </span>
            <span
                className={`truncate flex-1 min-w-0 ${isVerified ? 'text-foreground' : 'text-gray-400 italic'}`}
                title={displayText}
            >
                {displayText || <span className="text-gray-300">—</span>}
            </span>
            {isHovering && langData?.wordId && (
                <span className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => updateVerification(isVerified ? 0 : 1)}
                        className="text-xs w-4 h-4 flex items-center justify-center rounded hover:bg-green-100 hover:text-green-700"
                        title={isVerified ? 'Снять верификацию' : 'Верифицировать'}
                    >
                        ✓
                    </button>
                    <button
                        onClick={() => updateVerification(0)}
                        className="text-xs w-4 h-4 flex items-center justify-center rounded hover:bg-red-100 hover:text-red-700"
                        title="Снять верификацию"
                    >
                        ✕
                    </button>
                </span>
            )}
        </div>
    );
}