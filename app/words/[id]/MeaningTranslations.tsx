"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { getMeaningTranslationRows } from "@/lib/lexicon/meaningTranslations";
import { getExternalDictionaryUrl } from "@/lib/dictionary/helper";

interface MeaningTranslationsProps {
    meanings: { id: number; meaning: string | null }[];
    translations: Parameters<typeof getMeaningTranslationRows>[0];
    expanded: boolean;
}

const focusStyle = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export default function MeaningTranslations({ meanings, translations, expanded }: MeaningTranslationsProps) {
    const t = useTranslations("word");
    const selectId = useId();
    const [selectedId, setSelectedId] = useState<number>();
    const [showMissing, setShowMissing] = useState(false);
    const meaning = meanings.find(({ id }) => id === selectedId) ?? meanings[0];
    if (!meaning) return null;

    const rows = getMeaningTranslationRows(translations, meaning.id);
    const visibleRows = showMissing ? rows : rows.filter(({ values }) => values.length > 0);

    return (
        <details open={expanded} className="mb-6 rounded-xl border border-slate-200">
            <summary className={`cursor-pointer rounded-lg px-3 py-3 text-base font-bold text-slate-800 ${focusStyle}`}>
                {t("comparison.title")}
            </summary>
            <div className="space-y-3 px-3 pb-3">
                {meanings.length > 1 && (
                    <div>
                        <label htmlFor={selectId} className="mb-1 block text-sm font-semibold text-slate-700">
                            {t("sections.meaning")}
                        </label>
                        <select
                            id={selectId}
                            value={meaning.id}
                            onChange={(event) => setSelectedId(Number(event.target.value))}
                            className={`w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 ${focusStyle}`}
                        >
                            {meanings.map(({ id, meaning: definition }, index) => {
                                const label = definition?.replace(/\s+/g, " ").trim() || t("sections.placeholder");
                                const summary = label.length > 85 ? `${label.slice(0, 84)}…` : label;
                                return <option key={id} value={id}>{index + 1}. {summary}</option>;
                            })}
                        </select>
                    </div>
                )}
                <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={showMissing}
                        onChange={(event) => setShowMissing(event.target.checked)}
                        className={focusStyle}
                    />
                    {t("comparison.showMissing")}
                </label>
                {visibleRows.length === 0 ? (
                    <p className="text-sm text-slate-600">{t("comparison.empty")}</p>
                ) : (
                    <table className="w-full table-fixed border-collapse text-left text-sm text-slate-800">
                        <caption className="sr-only">{t("comparison.title")}</caption>
                        <thead className="bg-slate-100">
                            <tr>
                                <th scope="col" className="w-2/5 px-2 py-2">{t("comparison.language")}</th>
                                <th scope="col" className="px-2 py-2">{t("comparison.translation")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleRows.map(({ code, values }) => (
                                <tr key={code} className="border-b border-slate-200 last:border-0">
                                    <th scope="row" className="wrap-break-word px-2 py-2 font-medium">
                                        {t(`languages.${code}`)}
                                    </th>
                                    <td className="wrap-break-word px-2 py-2">
                                        {values.length === 0 ? t("comparison.missing") : values.map((value, index) => (
                                            <span key={value}>
                                                {index > 0 && "; "}
                                                {value.split(",").map((part, partIndex) => {
                                                    const word = part.trim();
                                                    const url = word ? getExternalDictionaryUrl(code, word) : null;
                                                    return (
                                                        <span key={partIndex}>
                                                            {partIndex > 0 && ", "}
                                                            {url ? (
                                                                <a href={url} target="_blank" rel="noopener noreferrer" className={`text-blue-700 underline ${focusStyle}`}>
                                                                    {word}
                                                                </a>
                                                            ) : word}
                                                        </span>
                                                    );
                                                })}
                                            </span>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </details>
    );
}
