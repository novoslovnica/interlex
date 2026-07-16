import { useState, useEffect, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { CellContext } from '@tanstack/react-table';

interface LangObject {
    id: number;
    value: string | null;
    veryfied: number | null;
    message: string | null;
    wordId: number | null;
    meaningId: number | null;
}

function RejectDialog({
    open,
    onClose,
    onConfirm,
    initialMessage,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: (message: string) => void;
    initialMessage: string;
}) {
    const [text, setText] = useState(initialMessage);

    useEffect(() => {
        if (open) setText(initialMessage);
    }, [open, initialMessage]);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={onClose}
        >
            <div
                className="dark:bg-gray-800 dark:text-gray-100 bg-white rounded-lg shadow-xl p-4 w-80"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-sm font-semibold mb-2">Комментарий к отклонению</h3>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm resize-none h-20 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    placeholder="Укажите причину отклонения..."
                    autoFocus
                />
                <div className="flex justify-end gap-2 mt-3">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs rounded border dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300 hover:bg-gray-100"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={() => onConfirm(text)}
                        className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                    >
                        Отклонить
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export function EditableLanguageCell<TData>({ cell, row, column, table, getValue }: CellContext<any, LangObject[]>) {
    const langDataArray: LangObject[] = getValue() || [];
    const primary = langDataArray[0] || null;
    const hasMultiple = langDataArray.length > 1;

    const [value, setValue] = useState(primary?.value || '');
    const [isEditing, setIsEditing] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [localVeryfied, setLocalVeryfied] = useState(primary?.veryfied ?? 0);
    const [localMessage, setLocalMessage] = useState(primary?.message || '');
    const [showRejectDialog, setShowRejectDialog] = useState(false);

    useEffect(() => {
        setValue(primary?.value || '');
        setLocalVeryfied(primary?.veryfied ?? 0);
        setLocalMessage(primary?.message || '');
    }, [primary?.value, primary?.veryfied, primary?.message]);

    const onChange = (e: ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
    };

    const onSave = async () => {
        const wordId = primary?.wordId ?? row.original.id;
        const meaningId = primary?.meaningId ?? row.original.meaningId;

        if (!primary?.id) {
            if (!value || !meaningId) {
                setIsEditing(false);
                return;
            }
            try {
                const response = await fetch(`/api/lexicon/${wordId}/updateField`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        field: column.id,
                        newValue: value,
                        meaningId,
                    }),
                });

                if (!response.ok) throw new Error('Save failed');

                const updatedLangObject = await response.json();
                const tableMeta = table.options.meta as any;
                if (tableMeta?.updateCellData) {
                    tableMeta.updateCellData(row.index, column.id, [updatedLangObject]);
                }
            } catch {
                setValue('');
                alert('Не удалось сохранить изменения');
            }

            setIsEditing(false);
            return;
        }

        if (value === (primary.value || '')) {
            setIsEditing(false);
            return;
        }

        try {
            const response = await fetch(`/api/lexicon/${wordId}/updateField`, {
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

    const updateVerification = async (newVeryfied: number, rejectMessage?: string) => {
        const wordId = primary?.wordId ?? row.original.id;
        const meaningId = primary?.meaningId ?? row.original.meaningId;

        if (!wordId && !meaningId) return;

        try {
            const body: Record<string, unknown> = {
                field: column.id,
                veryfied: newVeryfied,
            };
            if (primary?.id) {
                body.translationId = primary.id;
            } else if (meaningId) {
                body.meaningId = meaningId;
            }
            if (rejectMessage !== undefined) {
                body.message = rejectMessage;
            }

            const response = await fetch(`/api/lexicon/${wordId}/updateField`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error('Verification failed');

            const updated = await response.json();

            setLocalVeryfied(updated.veryfied ?? newVeryfied);
            setLocalMessage(updated.message || '');

            const tableMeta = table.options.meta as any;
            if (tableMeta?.updateCellData) {
                if (primary?.id) {
                    const updatedArray = langDataArray.map((item, idx) =>
                        idx === 0 ? { ...item, veryfied: updated.veryfied ?? newVeryfied, message: updated.message || '' } : item
                    );
                    tableMeta.updateCellData(row.index, column.id, updatedArray);
                } else {
                    tableMeta.updateCellData(row.index, column.id, [updated]);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleReject = (rejectMessage: string) => {
        setShowRejectDialog(false);
        updateVerification(0, rejectMessage);
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
        <>
            <div
                className={`flex items-center gap-1 px-2 py-1 relative cursor-text rounded ${borderClass}`}
                onClick={() => setIsEditing(true)}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <span
                    className={`shrink-0 text-xs ${isVerified ? 'text-green-500' : localMessage ? 'text-amber-500' : 'text-gray-400'}`}
                    title={!isVerified && localMessage ? localMessage : undefined}
                >
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
                {isHovering && (primary || langDataArray.length === 0) && (
                    <span className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => updateVerification(isVerified ? 0 : 1)}
                            className="text-xs w-4 h-4 flex items-center justify-center rounded hover:bg-green-100 hover:text-green-700"
                            title={isVerified ? 'Снять верификацию' : 'Верифицировать'}
                        >
                            ✓
                        </button>
                        <button
                            onClick={() => {
                                if (isVerified) {
                                    updateVerification(0);
                                } else {
                                    setShowRejectDialog(true);
                                }
                            }}
                            className="text-xs w-4 h-4 flex items-center justify-center rounded hover:bg-red-100 hover:text-red-700"
                            title="Снять верификацию"
                        >
                            ✕
                        </button>
                    </span>
                )}
                {!isVerified && localMessage && !isHovering && (
                    <span className="shrink-0 text-[9px] text-amber-600 bg-amber-50 px-1 rounded truncate max-w-[80px]" title={localMessage}>
                        {localMessage}
                    </span>
                )}
            </div>
            <RejectDialog
                open={showRejectDialog}
                onClose={() => setShowRejectDialog(false)}
                onConfirm={handleReject}
                initialMessage={localMessage}
            />
        </>
    );
}