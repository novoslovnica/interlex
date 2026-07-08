import { useState, useEffect, ChangeEvent } from 'react';
import { CellContext } from '@tanstack/react-table';

interface LangObject {
    id: number;
    value: string | null;
    veryfied: number | null;
    wordId: number | null;
    meaningId: number | null;
}

export function EditableLanguageCell<TData>({ cell, row, column, table, getValue }: CellContext<any, LangObject[]>) {
    const langDataArray: LangObject[] = getValue() || [];
    const primary = langDataArray[0] || null;
    const hasMultiple = langDataArray.length > 1;

    const [value, setValue] = useState(primary?.value || '');
    const [isEditing, setIsEditing] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [localVeryfied, setLocalVeryfied] = useState(primary?.veryfied ?? 0);

    useEffect(() => {
        setValue(primary?.value || '');
        setLocalVeryfied(primary?.veryfied ?? 0);
    }, [primary?.value, primary?.veryfied]);

    const onChange = (e: ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
    };

    const onSave = async () => {
        if (!primary?.id || value === (primary.value || '')) {
            setIsEditing(false);
            return;
        }

        try {
            const response = await fetch(`/api/lexicon/${primary.wordId ?? primary.meaningId}/updateField`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    field: column.id,
                    newValue: value,
                    translationId: primary.id,
                }),
            });

            if (!response.ok) throw new Error('Save failed');

            const updatedLangObject = await response.json();
            const tableMeta = table.options.meta as any;
            if (tableMeta?.updateCellData) {
                const updatedArray = langDataArray.map((item, idx) =>
                    idx === 0 ? updatedLangObject : item
                );
                tableMeta.updateCellData(row.index, column.id, updatedArray);
            }
        } catch {
            setValue(primary?.value || '');
            alert('Не удалось сохранить изменения');
        }

        setIsEditing(false);
    };

    const updateVerification = async (newVeryfied: number) => {
        if (!primary?.wordId && !primary?.meaningId) return;

        try {
            const response = await fetch(`/api/lexicon/${primary.wordId ?? primary.meaningId}/updateField`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    field: column.id,
                    veryfied: newVeryfied,
                    translationId: primary.id,
                }),
            });

            if (!response.ok) throw new Error('Verification failed');

            setLocalVeryfied(newVeryfied);

            const tableMeta = table.options.meta as any;
            if (tableMeta?.updateCellData) {
                const updatedArray = langDataArray.map((item, idx) =>
                    idx === 0 ? { ...item, veryfied: newVeryfied } : item
                );
                tableMeta.updateCellData(row.index, column.id, updatedArray);
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
    const displayText = primary?.value || '';
    const borderClass = hasMultiple ? 'border-2 border-red-400' : 'border border-transparent';

    return (
        <div
            className={`flex items-center gap-1 px-2 py-1 relative cursor-text rounded ${borderClass}`}
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
            {hasMultiple && (
                <span className="shrink-0 text-[10px] font-bold text-red-500 bg-red-50 px-1 rounded">
                    ×{langDataArray.length}
                </span>
            )}
            {isHovering && primary && (
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