'use client';
import React from 'react';
import { useTranslations } from 'next-intl';
import { generateNumeralForm, EnhancedNumDbItem } from '@/lib/grammar/numerals/cardinal';
import { Case, NumberType } from '@/lib/grammar/noun/index';
import { GrammaticalGender } from '@/lib/grammar/common/gender';

interface NumeralDeclensionTablesProps {
    isv: string;
    paradigm: string;
}

export const NumeralDeclensionTables: React.FC<NumeralDeclensionTablesProps> = ({ isv, paradigm }) => {
    const t = useTranslations("word");
    const numClass = detectNumClass(isv);
    const dbItem: EnhancedNumDbItem = {
        interslavic: isv,
        protoSlavic: isv,
        paradigm: paradigm as any,
        numClass,
    };

    const CASES = [
        { key: Case.NOMINATIVE, lookup: 'nominative' },
        { key: Case.GENITIVE, lookup: 'genitive' },
        { key: Case.DATIVE, lookup: 'dative' },
        { key: Case.ACCUSATIVE, lookup: 'accusative' },
        { key: Case.INSTRUMENTAL, lookup: 'instrumental' },
        { key: Case.LOCATIVE, lookup: 'locative' },
        { key: Case.VOCATIVE, lookup: 'vocative' },
    ] as const;

    if (numClass === 'one') {
        const GENDERS = ['masc', 'fem', 'neut'] as const;
        const NUMBERS = [
            { key: NumberType.SINGULAR, title: t('numbers.singular') },
            { key: NumberType.DUAL, title: t('numbers.dual') },
            { key: NumberType.PLURAL, title: t('numbers.plural') },
        ] as const;

        return (
            <div className="p-4 bg-slate-50 rounded-xl space-y-4">
                {GENDERS.map((genderLabel) => {
                    const gender = genderLabel === 'masc' ? GrammaticalGender.MASC
                        : genderLabel === 'fem' ? GrammaticalGender.FEM
                            : GrammaticalGender.NEUT;
                    return (
                        <div key={genderLabel}>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
                                {genderLabel === 'masc' ? t('genders.masculineShort') : genderLabel === 'fem' ? t('genders.feminineShort') : t('genders.neuterShort')}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {NUMBERS.map((n) => (
                                    <div key={n.key} className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">{n.title}</h4>
                                        <div className="space-y-3">
                                            {CASES.map((c) => {
                                                const form = generateNumeralForm({ dbItem, targetCase: c.key, targetNumber: n.key, targetGender: gender });
                                                return (
                                                    <div key={c.key} className="flex justify-between items-baseline gap-2 text-sm">
                                                        <span className="text-slate-400 font-medium shrink-0">{t(`cases.${c.lookup}Short`)}</span>
                                                        <span className="text-blue-700 font-semibold text-right break-all">{form}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    if (numClass === 'two_to_four') {
        const GENDERS = ['masc', 'fem', 'neut'] as const;
        return (
            <div className="p-4 bg-slate-50 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {GENDERS.map((genderLabel) => {
                        const gender = genderLabel === 'masc' ? GrammaticalGender.MASC
                            : genderLabel === 'fem' ? GrammaticalGender.FEM
                                : GrammaticalGender.NEUT;
                        return (
                            <div key={genderLabel} className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
                                    {genderLabel === 'masc' ? t('genders.masculineShort') : genderLabel === 'fem' ? t('genders.feminineShort') : t('genders.neuterShort')}
                                </h3>
                                <div className="space-y-3">
                                    {CASES.map((c) => {
                                        const form = generateNumeralForm({ dbItem, targetCase: c.key, targetNumber: NumberType.PLURAL, targetGender: gender });
                                        return (
                                            <div key={c.key} className="flex justify-between items-baseline gap-2 text-sm">
                                                <span className="text-slate-400 font-medium shrink-0">{t(`cases.${c.lookup}Short`)}</span>
                                                <span className="text-blue-700 font-semibold text-right break-all">{form}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-slate-50 rounded-xl">
            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
                    {t('numeral.section5to10')}
                </h3>
                <div className="space-y-3">
                    {CASES.map((c) => {
                        const form = generateNumeralForm({ dbItem, targetCase: c.key, targetNumber: NumberType.SINGULAR });
                        return (
                            <div key={c.key} className="flex justify-between items-baseline gap-2 text-sm">
                                <span className="text-slate-400 font-medium shrink-0">{t(`cases.${c.lookup}Short`)}</span>
                                <span className="text-blue-700 font-semibold text-right break-all">{form}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

function detectNumClass(isv: string): 'one' | 'two_to_four' | 'five_to_ten' {
    if (isv === 'edin') return 'one';
    if (['dva', 'tri', 'četyri', 'četyre'].includes(isv)) return 'two_to_four';
    return 'five_to_ten';
}