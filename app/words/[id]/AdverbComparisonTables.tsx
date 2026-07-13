'use client';
import React from 'react';
import { useTranslations } from 'next-intl';

interface AdverbComparisonTablesProps {
    isv: string;
}

function generateAdverbDegrees(lemma: string): { positive: string; comparative: string | null; superlative: string | null } {
    const positive = lemma;

    const isQualitative = lemma.endsWith('o') || lemma.endsWith('ě') || lemma.endsWith('e');
    if (!isQualitative || lemma.length <= 2) {
        return { positive, comparative: null, superlative: null };
    }

    const cleanBase = lemma.slice(0, -1);
    const comparative = cleanBase + 'ěje';
    const superlative = 'naj' + comparative;

    return { positive, comparative, superlative };
}

export const AdverbComparisonTables: React.FC<AdverbComparisonTablesProps> = ({ isv }) => {
    const t = useTranslations("word");
    const { positive, comparative, superlative } = generateAdverbDegrees(isv);

    const rows = [
        { key: 'pos', value: positive },
        ...(comparative ? [{ key: 'comp', value: comparative }] : []),
        ...(superlative ? [{ key: 'sup', value: superlative }] : []),
    ];

    const LABELS: Record<string, string> = {
        pos: t('adjective.positive'),
        comp: t('adjective.comparative'),
        sup: t('adjective.superlative'),
    };

    return (
        <div className="p-4 bg-slate-50 rounded-xl">
            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                <div className="space-y-3">
                    {rows.map((row) => (
                        <div key={row.key} className="flex justify-between items-baseline gap-2 text-sm">
                            <span className="text-slate-400 font-medium">{LABELS[row.key]}</span>
                            <span className="text-blue-700 font-semibold text-right break-all">{row.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};