'use client';
import React from 'react';
import { useTranslations } from 'next-intl';
import { generatePronounForm, classifyPronoun, EnhancedPronounDbItem } from '@/lib/grammar/pronoun/index';
import { Case, NumberType } from '@/lib/grammar/endingsRegistry';
import { GrammaticalGender } from '@/lib/grammar/common/gender';
import { AccentParadigm } from '@/lib/grammar/common/paradigm';

import {capitalize} from "@/lib/script-mode";

interface PronounDeclensionTablesProps {
    isv: string;
    paradigm: string;
    properNoun?: boolean;
}

export const PronounDeclensionTables: React.FC<PronounDeclensionTablesProps> = ({ isv, paradigm, properNoun = false }) => {
    const t = useTranslations("word");
    const cap = (s: string) => properNoun ? capitalize(s) : s;
    const analysis = classifyPronoun(isv);

    const dbItem: EnhancedPronounDbItem = {
        interslavic: isv,
        protoSlavic: isv,
        paradigm: paradigm as AccentParadigm,
        pronClass: analysis.pronClass,
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

    const NUMBERS = [
        { key: NumberType.SINGULAR, title: t('numbers.singular') },
        { key: NumberType.DUAL, title: t('numbers.dual') },
        { key: NumberType.PLURAL, title: t('numbers.plural') },
    ] as const;

    if (analysis.pronClass === 'personal' || analysis.pronClass === 'reflexive') {
        // my/vy — сетка ja/ty только во множественном, возвратное — только в единственном.
        const numbers = analysis.pronClass === 'reflexive'
            ? NUMBERS.filter((n) => n.key === NumberType.SINGULAR)
            : NUMBERS.filter((n) => !analysis.onlyNumber || n.key === analysis.onlyNumber);
        return (
            <div className="p-4 bg-slate-50 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {numbers.map((n) => (
                        <div key={n.key} className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
                                {n.title}
                            </h3>
                            <div className="space-y-3">
                                {CASES.map((c) => {
                                    const fullForm = generatePronounForm({ dbItem, targetCase: c.key, targetNumber: n.key, isEnclitic: false });
                                    const shortForm = generatePronounForm({ dbItem, targetCase: c.key, targetNumber: n.key, isEnclitic: true });
                                    return (
                                        <div key={c.key} className="flex justify-between items-baseline gap-2 text-sm">
                                            <span className="text-slate-400 font-medium shrink-0">{t(`cases.${c.lookup}Short`)}</span>
                                            <span className="text-blue-700 font-semibold text-right break-all">
                                                {cap(fullForm)}
                                                {shortForm !== fullForm && (
                                                    <span className="text-slate-400 font-normal text-xs ml-1">({cap(shortForm)})</span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (analysis.pronClass === 'anaphoric' || analysis.pronClass === 'pronominal') {
        // Склоняются по родам: единственное число по трём родам и множественное.
        const GENDERS = [
            { key: GrammaticalGender.MASC, lookup: 'masculine' },
            { key: GrammaticalGender.FEM, lookup: 'feminine' },
            { key: GrammaticalGender.NEUT, lookup: 'neuter' },
        ] as const;
        const sections = NUMBERS.filter((n) => n.key !== NumberType.DUAL);
        return (
            <div className="p-4 bg-slate-50 rounded-xl space-y-6">
                {sections.map((n) => (
                    <div key={n.key}>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">{n.title}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {GENDERS.map((g) => (
                                <div key={g.key} className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
                                        {t(`genders.${g.lookup}`)}
                                    </h4>
                                    <div className="space-y-3">
                                        {CASES.map((c) => (
                                            <div key={c.key} className="flex justify-between items-baseline gap-2 text-sm">
                                                <span className="text-slate-400 font-medium shrink-0">{t(`cases.${c.lookup}Short`)}</span>
                                                <span className="text-blue-700 font-semibold text-right break-all">
                                                    {cap(generatePronounForm({ dbItem, targetCase: c.key, targetNumber: n.key, targetGender: g.key }))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="p-4 bg-slate-50 rounded-xl">
            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                <div className="space-y-3">
                    {CASES.map((c) => {
                        const form = generatePronounForm({
                            dbItem, targetCase: c.key, targetNumber: NumberType.SINGULAR, targetGender: GrammaticalGender.MASC,
                        });
                        return (
                            <div key={c.key} className="flex justify-between items-baseline gap-2 text-sm">
                                <span className="text-slate-400 font-medium shrink-0">{t(`cases.${c.lookup}Short`)}</span>
                                <span className="text-blue-700 font-semibold text-right break-all">{cap(form)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
