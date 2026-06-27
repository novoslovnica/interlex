import { useState, useEffect, ChangeEvent } from 'react';
import {Cell, CellContext, Row, Table} from '@tanstack/react-table';

interface LangObject {
    id: number;
    value: string | null;
    veryfied: number | null;
    wordId: number | null;
    meaningId: number | null;
}

export function EditableLanguageCell<TData>({ cell, row, column, table, getValue }: CellContext<any, LangObject>) {
    const langData = getValue();

    // Локальный стейт для текста в инпуте
    const [value, setValue] = useState(langData?.value || '');

    useEffect(() => {
        setValue(langData?.value || '');
    }, [langData?.value]);

    const onChange = (e: ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
    };

    const onSave = async () => {
        // Если объект пустой или значение не изменилось, ничего не делаем
        if (!langData?.id || value === langData.value) return;

        try {
            const response = await fetch(`/api/lexicon/${langData.wordId}/updateField`, { // Укажите ваш путь к API
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    field: column.id,
                    newValue: value,
                }),
            });

            if (!response.ok) {
                throw new Error('Ошибка при сохранении');
            }
            const updatedLangObject = await response.json();

            // Здесь можно вызвать метод для обновления локальных данных таблицы,
            // если ваша библиотека фетчинга (например, React Query) не делает это автоматически.
            const tableMeta = table.options.meta as any;
            if (tableMeta?.updateCellData) {
                tableMeta.updateCellData(row.index, column.id, updatedLangObject);
            }
            console.log('Успешно обновлено');
        } catch (error) {
            console.error(error);
            // Возвращаем старое значение в инпут в случае ошибки
            setValue(langData?.value || '');
            alert('Не удалось сохранить изменения');
        }
    };

    return (
        <input
            value={value}
            onChange={onChange}
            onBlur={onSave}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    onSave();
                    (e.target as HTMLInputElement).blur(); // Убираем фокус при Enter
                }
            }}
            className="w-full bg-transparent px-2 py-1 border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white outline-none rounded transition"
        />
    );
}
