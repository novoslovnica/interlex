'use client';

import React, { useState, useEffect } from 'react';
import { mergeWordsAction } from '../deduplication/actions';
import { getWordsByIds } from '../deduplication/getWordsByIds';

interface WordItem {
    id: number;
    value: string;
    external_id: number | null;
    isv: string;
    nsl: string;
    stem: string;
    pos: string;
    gender: string;
    declension: number | null;
    conjugation: number | null;
    transcription: string;
    mainCategory: string;
    etymology: string;
    usageType: string;
    addition: string;
    translations: Record<string, string[]>;
}

interface DeduplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentWord: {
        id: number;
        value: string;
        isv: string;
    };
    duplicateIds: number[];
    onMergeComplete?: () => void;
}

export default function DeduplicationModal({ isOpen, onClose, currentWord, duplicateIds, onMergeComplete }: DeduplicationModalProps) {
    const [words, setWords] = useState<WordItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDuplicateId, setSelectedDuplicateId] = useState<number | null>(null);
    const [mainWord, setMainWord] = useState<WordItem | null>(null);
    const [duplicateWord, setDuplicateWord] = useState<WordItem | null>(null);
    const [mergedValue, setMergedValue] = useState('');
    const [mergedIsv, setMergedIsv] = useState('');
    const [mergedNsl, setMergedNsl] = useState('');
    const [mergedStem, setMergedStem] = useState('');
    const [mergedPos, setMergedPos] = useState('');
    const [mergedGender, setMergedGender] = useState('');
    const [mergedDeclension, setMergedDeclension] = useState('');
    const [mergedConjugation, setMergedConjugation] = useState('');
    const [mergedTranscription, setMergedTranscription] = useState('');
    const [mergedMainCategory, setMergedMainCategory] = useState('');
    const [mergedEtymology, setMergedEtymology] = useState('');
    const [mergedUsageType, setMergedUsageType] = useState('');
    const [mergedAddition, setMergedAddition] = useState('');
    const [mergedExternalId, setMergedExternalId] = useState('');

    useEffect(() => {
        if (!isOpen || duplicateIds.length === 0) {
            setWords([]);
            setMainWord(null);
            setDuplicateWord(null);
            return;
        }
        setIsLoading(true);
        const idsToFetch = [currentWord.id, ...duplicateIds.filter(id => id !== currentWord.id)];
        getWordsByIds(idsToFetch).then((results) => {
            const typedResults = results as WordItem[];
            setWords(typedResults);
            if (typedResults.length >= 2) {
                const current = typedResults.find((w: WordItem) => w.id === currentWord.id);
                const firstDup = typedResults.find((w: WordItem) => w.id !== currentWord.id);
                if (current && firstDup) {
                    setMainWord(current);
                    setDuplicateWord(firstDup);
                    setSelectedDuplicateId(firstDup.id);
                    syncFormFields(current, firstDup);
                }
            }
            setIsLoading(false);
        });
    }, [isOpen, currentWord.id, duplicateIds.join(',')]);

    const syncFormFields = (target: WordItem, source: WordItem) => {
        setMergedValue(target.value);
        setMergedIsv(target.isv);
        setMergedNsl(target.nsl || source.nsl);
        setMergedStem(target.stem || source.stem);
        setMergedPos(target.pos || source.pos);
        setMergedGender(target.gender || source.gender);
        setMergedDeclension(target.declension != null ? String(target.declension) : (source.declension != null ? String(source.declension) : ''));
        setMergedConjugation(target.conjugation != null ? String(target.conjugation) : (source.conjugation != null ? String(source.conjugation) : ''));
        setMergedTranscription(target.transcription || source.transcription);
        setMergedMainCategory(target.mainCategory || source.mainCategory);
        setMergedEtymology(target.etymology || source.etymology);
        setMergedUsageType(target.usageType || source.usageType);
        const sourcesCombined = Array.from(new Set([target.addition, source.addition].filter(Boolean)));
        setMergedAddition(sourcesCombined.join(', '));
        setMergedExternalId(target.external_id != null ? String(target.external_id) : (source.external_id != null ? String(source.external_id) : ''));
    };

    const handleSelectDuplicate = (id: number) => {
        setSelectedDuplicateId(id);
        const dup = words.find(w => w.id === id);
        const current = words.find(w => w.id === currentWord.id);
        if (dup && current) {
            setMainWord(current);
            setDuplicateWord(dup);
            syncFormFields(current, dup);
        }
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
            stem: mergedStem || undefined,
            pos: mergedPos || undefined,
            gender: mergedGender || undefined,
            declension: mergedDeclension ? Number(mergedDeclension) : null,
            conjugation: mergedConjugation ? Number(mergedConjugation) : null,
            transcription: mergedTranscription || undefined,
            mainCategory: mergedMainCategory || undefined,
            etymology: mergedEtymology || undefined,
            usageType: mergedUsageType,
            addition: mergedAddition,
            external_id: mergedExternalId ? Number(mergedExternalId) : null,
        });
        setIsLoading(false);
        if (result.success) {
            onMergeComplete?.();
            onClose();
        } else {
            alert(`Ошибка: ${result.error}`);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden">
            <div className="bg-background border rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh]">
                <div className="p-5 border-b flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-base font-bold">Дедупликация</h3>
                        <p className="text-xs text-muted-foreground">Слияние дублирующихся записей</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 text-lg">✕</button>
                </div>

                <div className="p-5 overflow-y-auto space-y-4 flex-1">
                    {isLoading && words.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground py-8">Загрузка данных...</div>
                    ) : (
                        <>
                            {duplicateIds.filter(id => id !== currentWord.id).length > 1 && (
                                <div>
                                    <label className="block text-xs font-semibold mb-2">Выберите дубликат для слияния:</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md bg-background"
                                        value={selectedDuplicateId ?? ''}
                                        onChange={(e) => handleSelectDuplicate(Number(e.target.value))}
                                    >
                                        {words.filter(w => w.id !== currentWord.id).map(w => (
                                            <option key={w.id} value={w.id}>{w.value} / {w.isv} (ID: {w.id})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {mainWord && duplicateWord && (
                                <>
                                    <div className="grid grid-cols-7 gap-2 items-center bg-muted/40 p-3 rounded-xl border text-center text-xs shrink-0">
                                        <div className="col-span-3 p-2 bg-green-500/10 text-green-700 border border-green-500/20 rounded-lg">
                                            <span className="block uppercase font-bold text-[9px]">СОХРАНИТЬ (ID: {mainWord.id})</span>
                                            <span className="font-semibold block truncate">{mainWord.value} / {mainWord.isv}</span>
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            <button type="button" onClick={handleSwap} className="p-2 border rounded-full bg-background hover:bg-muted font-bold shadow-xs active:scale-95 transition-transform">⇄</button>
                                        </div>
                                        <div className="col-span-3 p-2 bg-red-500/10 text-red-700 border border-red-500/20 rounded-lg">
                                            <span className="block uppercase font-bold text-[9px]">УДАЛИТЬ (ID: {duplicateWord.id})</span>
                                            <span className="font-semibold block truncate">{duplicateWord.value} / {duplicateWord.isv}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold mb-1">Value</label>
                                                <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500" value={mergedValue} onChange={e => setMergedValue(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold mb-1">ISV</label>
                                                <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500" value={mergedIsv} onChange={e => setMergedIsv(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold mb-1">NSL</label>
                                                <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background" value={mergedNsl} onChange={e => setMergedNsl(e.target.value)} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold mb-1">Основа (stem)</label>
                                                <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500" value={mergedStem} onChange={e => setMergedStem(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold mb-1">Часть речи (POS)</label>
                                                <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background" value={mergedPos} onChange={e => setMergedPos(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold mb-1">Род (gender)</label>
                                                <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background" value={mergedGender} onChange={e => setMergedGender(e.target.value)} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold mb-1">Склонение</label>
                                                <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background" value={mergedDeclension} onChange={e => setMergedDeclension(e.target.value)} placeholder="напр. 1" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold mb-1">Спряжение</label>
                                                <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background" value={mergedConjugation} onChange={e => setMergedConjugation(e.target.value)} placeholder="напр. 1" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold mb-1">Транскрипция (IPA)</label>
                                                <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500" value={mergedTranscription} onChange={e => setMergedTranscription(e.target.value)} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold mb-1">Категория (mainCategory)</label>
                                                <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background" value={mergedMainCategory} onChange={e => setMergedMainCategory(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold mb-1">Тип употребления</label>
                                                <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background" value={mergedUsageType} onChange={e => setMergedUsageType(e.target.value)} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold mb-1">Этимология</label>
                                            <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500" value={mergedEtymology} onChange={e => setMergedEtymology(e.target.value)} />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold mb-1">Источники (поле addition)</label>
                                            <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background focus:ring-2 focus:ring-blue-500" value={mergedAddition} onChange={e => setMergedAddition(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold mb-1">Внешний ID (external_id)</label>
                                            <input type="text" className="w-full px-3 py-1.5 border rounded-md bg-background" value={mergedExternalId} onChange={e => setMergedExternalId(e.target.value)} placeholder="напр. 12345" />
                                        </div>
                                    </div>

                                    <div className="p-3 bg-yellow-500/5 text-yellow-700 border border-yellow-500/10 rounded-xl text-xs">
                                        💡 Все переводы, морфемы, аномалии флексий, синонимы, антонимы и омонимы будут перенесены на сохраняемый ID.
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className="p-4 border-t bg-muted/10 flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-xs font-semibold hover:bg-background transition-colors" disabled={isLoading}>Отмена</button>
                    <button type="button" onClick={handleMergeSubmit} disabled={isLoading || !mainWord || !duplicateWord} className="px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                        {isLoading ? 'Сохранение...' : 'Выполнить мерж'}
                    </button>
                </div>
            </div>
        </div>
    );
}