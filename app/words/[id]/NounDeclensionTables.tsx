'use client';
import React from 'react';
import { useTranslations } from 'next-intl';

interface CaseForms {
    [caseName: string]: string;
}

interface NounDeclensionTablesProps {
    data: {
        singular: CaseForms;
        dual?: CaseForms;
        plural: CaseForms;
    };
}

export const NounDeclensionTables: React.FC<NounDeclensionTablesProps> = ({ data }) => {
    const t = useTranslations("word");

    const CASES = [
        { key: 'nominative', lookup: 'nominative' },
        { key: 'genitive', lookup: 'genitive' },
        { key: 'dative', lookup: 'dative' },
        { key: 'accusative', lookup: 'accusative' },
        { key: 'instrumental', lookup: 'instrumental' },
        { key: 'locative', lookup: 'locative' },
        { key: 'vocative', lookup: 'vocative' },
    ] as const;

    const columns = [
        { title: t('numbers.singular'), forms: data.singular },
        { title: t('numbers.dual'), forms: data.dual },
        { title: t('numbers.plural'), forms: data.plural },
    ].filter(col => col.forms);

    return (
        <div className="p-4 bg-slate-50 rounded-xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {columns.map((col, cIdx) => (
                    <div
                        key={cIdx}
                        className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex flex-col justify-between"
                    >
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
                                {col.title}
                            </h3>
                            <div className="space-y-3">
                                {CASES.map((c) => {
                                    const formValue = col.forms?.[c.key];
                                    if (!formValue) return null;

                                    return (
                                        <div key={c.key} className="flex justify-between items-baseline gap-2 text-sm">
                                            <span className="text-slate-400 font-medium shrink-0" title={t(`cases.${c.lookup}`)}>
                                                {t(`cases.${c.lookup}Short`)}
                                            </span>
                                            <span className="text-blue-700 font-semibold text-right break-all">
                                                {formValue}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};