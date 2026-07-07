'use client';

import React, { useState, useEffect } from 'react';
import {mergeWordsAction, searchDuplicateWords} from './actions';

// Моковые типы на основе вашей конфигурации БД (адаптируйте под схему Prisma)
interface WordItem {
    id: string;
    isv_lemma: string;
    isv_cyr?: string;
    translations: Record<string, string>; // например: { ru: 'мир', en: 'peace', pl: 'pokój' }
    sources: string[];
}

export default function DeduplicationPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [words, setWords] = useState<WordItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Состояния мержа
    const [mainWord, setMainWord] = useState<WordItem | null>(null);
    const [duplicateWord, setDuplicateWord] = useState<WordItem | null>(null);

    // Поля конструктора
    const [mergedValue, setMergedValue] = useState('');
    const [mergedIsv, setMergedIsv] = useState('');
    const [mergedNsl, setMergedNsl] = useState('');
    const [mergedType, setMergedType] = useState('');
    const [mergedAddition, setMergedAddition] = useState('');

    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            setWords([]);
            return;
        }
        setIsLoading(true);
        const delayDebounce = setTimeout(async () => {
            const res = await searchDuplicateWords(searchQuery);
            setWords(res as WordItem[]);
            setIsLoading(false);
        }, 400);

        return () => clearTimeout(delayDebounce);
    }, [searchQuery]);

    const handleCheckboxChange = (id: number) => {
        setSelectedIds(prev => {
            if (prev.includes(id)) return prev.filter(i => i !== id);
            if (prev.length >= 2) {
                alert('Выберите строго 2 слова для проведения слияния.');
                return prev;
            }
            return [...prev, id];
        });
    };

    const openMergeModal = () => {
        if (selectedIds.length !== 2) return;
        const item1 = words.find(w => w.id === selectedIds[0]);
        const item2 = words.find(w => w.id === selectedIds[1]);

        if (item1 && item2) {
            setMainWord(item1);
            setDuplicateWord(item2);
            syncFormFields(item1, item2);
            setIsModalOpen(true);
        }
    };

    const syncFormFields = (target: WordItem, source: WordItem) => {
        setMergedValue(target.value);
        setMergedIsv(target.isv);
        setMergedNsl(target.nsl || source.nsl);
        setMergedType(target.type || source.type);

        // Склеиваем источники текстовой строкой, если они разные
        const sourcesCombined = Array.from(new Set([target.addition, source.addition].filter(Boolean)));
        setMergedAddition(sourcesCombined.join(', '));
    };

    const handleSwap = () => {
        if (!mainWord || !duplicateWord) return;
        const temp = mainWord;
        setMainWord(duplicateWord);
        setDuplicateWord(temp);
        syncFormFields(duplicateWord, temp);
    };

    const handleMergeSubmit = async () => {
        if (!mainWord || !duplicateWord) return;
        setIsLoading(true);

        const result = await mergeWordsAction(mainWord.id, duplicateWord.id, {
            value: mergedValue,
            isv: mergedIsv,
            nsl: mergedNsl,
            type: mergedType,
            addition: mergedAddition
        });

        setIsLoading(false);
        if (result.success) {
            alert('Объекты объединены. Смыслы и связи перенесены каскадно.');
            setIsModalOpen(false);
            setSelectedIds([]);
            setWords(await searchDuplicateWords(searchQuery));
        } else {
            alert(`Ошибка выполнения транзакции: ${result.error}`);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 text-sm text-foreground flex flex-col flex-1 overflow-y-auto min-h-0">
            {/* Поисковая панель */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/20 p-4 rounded-xl border shrink-0">
                <div className="w-full sm:flex-1 relative">
                    <input
                        type="text"
                        placeholder="Поиск по value или isv (минимум 2 символа)..."
                        className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {isLoading && (
                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground animate-pulse">
              Поиск...
            </span>
                    )}
                </div>
                <button
                    onClick={openMergeModal}
                    disabled={selectedIds.length !== 2 || isLoading}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm shrink-0"
                >
                    Объединить выбранные ({selectedIds.length}/2)
                </button>
            </div>

            {/* Таблица с независимым горизонтальным скроллом */}
            <div className="border rounded-xl bg-background shadow-sm overflow-auto max-w-full no-scrollbar">
                <table className="w-full text-left border-collapse table-auto min-w-[700px]">
                    <thead>
                    <tr className="bg-muted text-xs font-semibold uppercase border-b">
                        <th className="p-3 w-12 text-center select-none">Выбор</th>
                        <th className="p-3">Value</th>
                        <th className="p-3">ISV / NSL</th>
                        <th className="p-3">Переводы (Из Meanings)</th>
                        <th className="p-3">Источник (Addition)</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y">
                    {words.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                {isLoading ? 'Загрузка данных...' : 'Введите строку для поиска дубликатов'}
                            </td>
                        </tr>
                    ) : (
                        words.map((word) => (
                            <tr key={word.id} className="hover:bg-muted/10 transition-colors">
                                <td className="p-3 text-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(word.id)}
                                        onChange={() => handleCheckboxChange(word.id)}
                                        className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                                    />
                                </td>
                                <td className="p-3 font-semibold whitespace-nowrap">{word.value || '—'}</td>
                                <td className="p-3 whitespace-nowrap">
                                    <span className="block font-medium text-blue-600">{word.isv || '—'}</span>
                                    <span className="block text-xs text-muted-foreground">{word.nsl ? `NSL: ${word.nsl}` : ''}</span>
                                </td>
                                <td className="p-3">
                                    <div className="flex flex-wrap gap-1 max-w-xl">
                                        {Object.entries(word.translations).map(([lang, arr]) => (
                                            <span key={lang} className="px-1.5 py-0.5 bg-muted rounded text-xs whitespace-nowrap">
                          <strong className="uppercase mr-1 text-[10px] text-muted-foreground">{lang}:</strong>
                                                {arr.join(', ')}
                        </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-3 text-xs text-muted-foreground max-w-xs truncate" title={word.addition}>
                                    {word.addition}
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>

            {/* МОДАЛЬНОЕ ОКНО СЛИЯНИЯ */}
            {isModalOpen && mainWord && duplicateWord && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden">
                    <div className="bg-background border rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[85vh] md:max-h-[90vh]">

                        <div className="p-5 border-b flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-base font-bold">Конструктор слияния записей</h3>
                                <p className="text-xs text-muted-foreground">Смыслы (`Meaning`) и связи будут перенесены на сохраняемый ID.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground p-1 text-lg">✕</button>
                        </div>

                        {/* Внутренний скролл-контейнер модального окна */}
                        <div className="p-5 overflow-y-auto space-y-4 flex-1 max-h-[calc(85vh-130px)] md:max-h-[calc(90vh-130px)] no-scrollbar">

                            {/* Логика направления мержа */}
                            <div className="grid grid-cols-7 gap-2 items-center bg-muted/40 p-3 rounded-xl border text-center text-xs shrink-0">
                                <div className="col-span-3 p-2 bg-green-500/10 text-green-700 border border-green-500/20 rounded-lg">
                                    <span className="block uppercase font-bold text-[9px]">СОХРАНИТЬ (ID: {mainWord.id})</span>
                                    <span className="font-semibold block truncate">{mainWord.value} / {mainWord.isv}</span>
                                    <span className="text-[10px] text-muted-foreground truncate block">{mainWord.addition}</span>
                                </div>
                                <div className="col-span-1 flex justify-center">
                                    <button type="button" onClick={handleSwap} className="p-2 border rounded-full bg-background hover:bg-muted font-bold shadow-xs active:scale-95 transition-transform">⇄</button>
                                </div>
                                <div className="col-span-3 p-2 bg-red-500/10 text-red-700 border border-red-500/20 rounded-lg">
                                    <span className="block uppercase font-bold text-[9px]">УДAЛИТЬ (ID: {duplicateWord.id})</span>
                                    <span className="font-semibold block truncate">{duplicateWord.value} / {duplicateWord.isv}</span>
                                    <span className="text-[10px] text-muted-foreground truncate block">{duplicateWord.addition}</span>
                                </div>
                            </div>

                            {/* Поля */}
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1">Value</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                                            value={mergedValue}
                                            onChange={e => setMergedValue(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1">ISV</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                                            value={mergedIsv}
                                            onChange={e => setMergedIsv(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1">NSL</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-1.5 border rounded-md bg-background"
                                            value={mergedNsl}
                                            onChange={e => setMergedNsl(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1">Type (POS)</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-1.5 border rounded-md bg-background"
                                            value={mergedType}
                                            onChange={e => setMergedType(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold mb-1">Источники (Поле addition)</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500"
                                        value={mergedAddition}
                                        onChange={e => setMergedAddition(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="p-3 bg-yellow-500/5 text-yellow-700 border border-yellow-500/10 rounded-xl text-xs">
                                💡 **Инфо:** Все переводы языков (`Ru`, `En`, `Pl`...) привязаны к записям `Meaning`. Так как команда `updateMany` переносит сами объекты значений целиком на ID нового слова, структура и связи ваших переводов сохранятся без изменений и конфликтов на уровне БД.
                            </div>
                        </div>

                        {/* Футер модального окна */}
                        <div className="p-4 border-t bg-muted/10 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 border rounded-md text-xs font-semibold hover:bg-background transition-colors"
                                disabled={isLoading}
                            >
                                Отмена
                            </button>
                            <button
                                type="button"
                                onClick={handleMergeSubmit}
                                disabled={isLoading}
                                className="px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {isLoading ? 'Сохранение...' : 'Выполнить мерж'}
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

