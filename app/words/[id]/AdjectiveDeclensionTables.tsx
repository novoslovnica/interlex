'use client';
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { generateAdjectiveForm, EnhancedAdjDbItem } from '@/lib/grammar/adjective/index';
import { Case, NumberType } from '@/lib/grammar/noun/index';
import { GrammaticalGender } from '@/lib/grammar/common/gender';
import { AccentParadigm } from '@/lib/grammar/common/paradigm';
import { ProtoStemClass } from '@/lib/grammar/common/stem';

interface AdjectiveDeclensionTablesProps {
    isv: string;
    paradigm: string;
    protoStemClass: string;
    isQualitative?: boolean;
}

export const AdjectiveDeclensionTables: React.FC<AdjectiveDeclensionTablesProps> = ({
    isv,
    paradigm,
    protoStemClass,
    isQualitative = false,
}) => {
    const t = useTranslations("word");
    const [activeGender, setActiveGender] = useState<GrammaticalGender>(GrammaticalGender.MASC);
    const [activeDegree, setActiveDegree] = useState<'pos' | 'comp' | 'sup'>('pos');

    const CASES = [
        { key: Case.NOMINATIVE, lookup: 'nominative' },
        { key: Case.GENITIVE, lookup: 'genitive' },
        { key: Case.DATIVE, lookup: 'dative' },
        { key: Case.ACCUSATIVE, lookup: 'accusative' },
        { key: Case.INSTRUMENTAL, lookup: 'instrumental' },
        { key: Case.LOCATIVE, lookup: 'locative' },
        { key: Case.VOCATIVE, lookup: 'vocative' },
    ] as const;

    const GENDERS = [
        { key: GrammaticalGender.MASC, lookup: 'masculine' },
        { key: GrammaticalGender.FEM, lookup: 'feminine' },
        { key: GrammaticalGender.NEUT, lookup: 'neuter' },
    ] as const;

    const NUMBERS = [
        { key: NumberType.SINGULAR, title: t('numbers.singular') },
        { key: NumberType.DUAL, title: t('numbers.dual') },
        { key: NumberType.PLURAL, title: t('numbers.plural') },
    ] as const;

    const DEGREES: { key: 'pos' | 'comp' | 'sup'; lookup: string }[] = [
        { key: 'pos', lookup: 'adjective.positive' },
        { key: 'comp', lookup: 'adjective.comparative' },
        { key: 'sup', lookup: 'adjective.superlative' },
    ];

    function generateAdjFormWithDegree(
        dbItem: EnhancedAdjDbItem,
        targetCase: Case,
        targetNumber: NumberType,
        targetGender: GrammaticalGender,
        degree: 'pos' | 'comp' | 'sup'
    ): string {
        if (degree === 'pos') {
            return generateAdjectiveForm({ dbItem, targetCase, targetNumber, targetGender });
        }

        const base = dbItem.interslavic.slice(0, -1);
        const softDbItem: EnhancedAdjDbItem = {
            ...dbItem,
            protoStemClass: ProtoStemClass.JO_SHORT,
        };
        let stem: string;
        if (degree === 'comp') {
            stem = base + 'ějš';
        } else {
            stem = 'naj' + base + 'ějš';
        }
        return generateAdjectiveForm({
            dbItem: { ...softDbItem, interslavic: stem + 'i' },
            targetCase,
            targetNumber,
            targetGender,
        });
    }

    const dbItem: EnhancedAdjDbItem = {
        interslavic: isv,
        protoSlavic: isv,
        paradigm: paradigm as AccentParadigm,
        protoStemClass: protoStemClass as ProtoStemClass,
    };

    const columns = NUMBERS.map(n => ({
        title: n.title,
        forms: CASES.reduce((acc, c) => ({
            ...acc,
            [c.key]: generateAdjFormWithDegree(dbItem, c.key, n.key, activeGender, activeDegree),
        }), {} as Record<string, string>),
    }));

    return (
        <div className="p-4 bg-slate-50 rounded-xl space-y-4">
            {isQualitative && (
                <div className="flex gap-2 border-b border-slate-200/60 pb-2">
                    {DEGREES.map((d) => (
                        <button
                            key={d.key}
                            onClick={() => setActiveDegree(d.key)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                activeDegree === d.key
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'text-slate-500 hover:bg-slate-100'
                            }`}
                        >
                            {t(d.lookup)}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex gap-2 border-b border-slate-200/60 pb-2">
                {GENDERS.map((g) => (
                    <button
                        key={g.key}
                        onClick={() => setActiveGender(g.key)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            activeGender === g.key
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t(`genders.${g.lookup}`)}
                    </button>
                ))}
            </div>
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
                                    const formValue = col.forms[c.key];
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