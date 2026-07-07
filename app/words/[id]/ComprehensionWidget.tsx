import React from 'react';
import { parseComprehensionString, SLAVIC_LANGUAGES_MAP } from '@/lib/types/lexicon';

interface ComprehensionWidgetProps {
    comprehensionData: string; // Например: "be+ cs+ hr- pl+ sk+ uk+"
}

export const ComprehensionWidget: React.FC<ComprehensionWidgetProps> = ({ comprehensionData }) => {
    const languages = parseComprehensionString(comprehensionData);

    if (languages.length === 0) return null;

    return (
        <div className="mt-6 mb-6 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Понятность в славянских языках
        </span>
            </div>

            {/* Flex-ряд с автоматическим переносом. Идеально для десктопа и мобильных */}
            <div className="flex flex-wrap gap-2">
                {languages.map(({ code, name, isUnderstood }) => {
                    const langMeta = SLAVIC_LANGUAGES_MAP[code];

                    return (
                        <div
                            key={code}
                            title={`${name}: ${isUnderstood ? 'Понятно без перевода' : 'Требует перевода'}`}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-default
                ${isUnderstood
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            }`}
                        >
                            <span>{langMeta?.flag}</span>
                            <span className="uppercase">{code}</span>

                            {/* Компактный графический маркер статуса */}
                            <span className={`w-1.5 h-1.5 rounded-full ${isUnderstood ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
