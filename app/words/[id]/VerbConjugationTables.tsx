'use client';
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ConjugationResult, FullParadigm, ParticipleSet } from '@/lib/grammar/verb/types/conjugator';
import {ScriptMode, writeOrTranslate, capitalize} from "@/lib/script-mode";

interface TablesProps {
    data: ConjugationResult;
    currentScript: ScriptMode;
    properNoun?: boolean;
}

export const VerbConjugationTables: React.FC<TablesProps> = ({ data, currentScript, properNoun = false }) => {
    const t = useTranslations("word");
    const [activeTab, setActiveTab] = useState<'indicative' | 'non-indicative' | 'participles'>('indicative');

    const cap = (s: string) => properNoun ? capitalize(s) : s;

    const renderTimeGrid = (title: string, paradigm: FullParadigm) => (
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
            <h4 className="font-bold text-slate-700 text-sm border-b pb-1.5 border-slate-100">{title}</h4>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[400px]">
                    <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                        <th className="py-2 font-medium">{t('verb.person')}</th>
                        <th className="py-2 font-medium">{t('numbers.singular')}</th>
                        <th className="py-2 font-medium">{t('numbers.dual')}</th>
                        <th className="py-2 font-medium">{t('numbers.plural')}</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700 font-medium">
                    <tr>
                        <td className="py-2 text-slate-400 font-normal">{t('verb.firstPerson')}</td>
                        <td className="py-2 text-blue-600 font-semibold">{cap(writeOrTranslate(paradigm['1sg'], currentScript))}</td>
                        <td className="py-2 text-indigo-600">{cap(writeOrTranslate(paradigm['1du'], currentScript))}</td>
                        <td className="py-2 text-slate-800">{cap(writeOrTranslate(paradigm['1pl'], currentScript))}</td>
                    </tr>
                    <tr>
                        <td className="py-2 text-slate-400 font-normal">{t('verb.secondPerson')}</td>
                        <td className="py-2 text-blue-600 font-semibold">{cap(writeOrTranslate(paradigm['2sg'], currentScript))}</td>
                        <td className="py-2 text-indigo-600">{cap(writeOrTranslate(paradigm['2du'], currentScript))}</td>
                        <td className="py-2 text-slate-800">{cap(writeOrTranslate(paradigm['2pl'], currentScript))}</td>
                    </tr>
                    <tr>
                        <td className="py-2 text-slate-400 font-normal">{t('verb.thirdPerson')}</td>
                        <td className="py-2 text-blue-600 font-semibold">{cap(writeOrTranslate(paradigm['3sg'], currentScript))}</td>
                        <td className="py-2 text-indigo-600">{cap(writeOrTranslate(paradigm['3du'], currentScript))}</td>
                        <td className="py-2 text-slate-800">{cap(writeOrTranslate(paradigm['3pl'], currentScript))}</td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderParticipleGrid = (title: string, ps: ParticipleSet) => (
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
            <h4 className="font-bold text-slate-700 text-sm border-b pb-1.5 border-slate-100">{title}</h4>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[300px]">
                    <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                        <th className="py-2 font-medium">{t('verb.person')}</th>
                        <th className="py-2 font-medium">{t('verb.form')}</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700 font-medium">
                    <tr>
                        <td className="py-2 text-slate-400 font-normal">{t('genders.masculine')}</td>
                        <td className="py-2 text-blue-600 font-semibold">{cap(writeOrTranslate(ps.masculine, currentScript))}</td>
                    </tr>
                    <tr>
                        <td className="py-2 text-slate-400 font-normal">{t('genders.feminine')}</td>
                        <td className="py-2 text-indigo-600">{cap(writeOrTranslate(ps.feminine, currentScript))}</td>
                    </tr>
                    <tr>
                        <td className="py-2 text-slate-400 font-normal">{t('genders.neuter')}</td>
                        <td className="py-2 text-emerald-600">{cap(writeOrTranslate(ps.neuter, currentScript))}</td>
                    </tr>
                    <tr>
                        <td className="py-2 text-slate-400 font-normal">{t('numbers.plural')}</td>
                        <td className="py-2 text-slate-800">{cap(writeOrTranslate(ps.plural, currentScript))}</td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-4 p-2">
            <div className="flex gap-2 border-b border-slate-200/60 pb-2">
                <button
                    onClick={() => setActiveTab('indicative')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        activeTab === 'indicative'
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-100'
                    }`}
                >
                    {t('verb.indicative')}
                </button>
                <button
                    onClick={() => setActiveTab('non-indicative')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        activeTab === 'non-indicative'
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-100'
                    }`}
                >
                    {t('verb.imperativeSubjunctive')}
                </button>
                <button
                    onClick={() => setActiveTab('participles')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        activeTab === 'participles'
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-100'
                    }`}
                >
                    {t('verb.participles')}
                </button>
            </div>

            {activeTab === 'indicative' ? (
                <div className="space-y-5">
                    {renderTimeGrid(
                        data.aspect === 'perfective' ? t('verb.tenses.futureSimple') : t('verb.tenses.present'),
                        data.indicative.presentOrFutureDirect
                    )}

                    {data.indicative.futureAnalytical && (
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
                            <h4 className="font-bold text-slate-700 text-sm">{t('verb.tenses.futureAnalytical')}</h4>
                            <div className="text-xs space-y-1 text-slate-600">
                                <div><span className="font-semibold text-blue-600">{t('verb.tenses.withByti')}</span> {cap(data.indicative.futureAnalytical.withByti['1sg'])}, {cap(data.indicative.futureAnalytical.withByti['2sg'])}...</div>
                                <div><span className="font-semibold text-emerald-600">{t('verb.tenses.withImati')}</span> {cap(data.indicative.futureAnalytical.withImati['1sg'])}, {cap(data.indicative.futureAnalytical.withImati['2sg'])}...</div>
                                <div><span className="font-semibold text-indigo-600">{t('verb.tenses.withHteti')}</span> {cap(data.indicative.futureAnalytical.withHtěti['1sg'])}, {cap(data.indicative.futureAnalytical.withHtěti['2sg'])}...</div>
                            </div>
                        </div>
                    )}

                    {renderTimeGrid(t('verb.tenses.aorist'), data.indicative.aorist)}

                    {renderTimeGrid(t('verb.tenses.imperfect'), data.indicative.imperfect)}

                    {renderTimeGrid(t('verb.tenses.perfect'), data.indicative.perfect.masculine)}

                    {renderTimeGrid(t('verb.tenses.pluperfect'), data.indicative.pluperfect.masculine)}
                </div>
            ) : activeTab === 'non-indicative' ? (
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
                        <h4 className="font-bold text-slate-700 text-sm">{t('verb.imperative')}</h4>
                        <div className="grid grid-cols-3 gap-4 text-xs font-semibold py-2 border-t border-slate-50">
                            <div><span className="text-slate-400 font-normal">{t('verb.imperativeLabels.sg')}</span> <span className="text-red-600">{cap(data.imperative['2sg'])}</span></div>
                            <div><span className="text-slate-400 font-normal">{t('verb.imperativeLabels.du')}</span> <span className="text-slate-800">{cap(data.imperative['2du'])}</span></div>
                            <div><span className="text-slate-400 font-normal">{t('verb.imperativeLabels.pl')}</span> <span className="text-slate-800">{cap(data.imperative['2pl'])}</span></div>
                        </div>
                    </div>

                    {renderTimeGrid(t('verb.conditional'), data.conditional.masculine)}
                </div>
            ) : (
                <div className="space-y-5">
                    {renderParticipleGrid(t('verb.participlesPresentActive'), data.participles.presentActive)}
                    {renderParticipleGrid(t('verb.participlesPresentPassive'), data.participles.presentPassive)}
                    {renderParticipleGrid(t('verb.participlesPastPassive'), data.participles.pastPassive)}
                </div>
            )}
        </div>
    );
};