import { TRANSLATION_LANGUAGES } from "@/config/features";
import type { TranslationRow } from "@/lib/translations";

type TranslationByMeaning = Pick<TranslationRow, "meaningId" | "value">;

export function getMeaningTranslationRows(
    translations: Partial<Record<string, readonly TranslationByMeaning[]>>,
    meaningId: number,
) {
    return TRANSLATION_LANGUAGES.map(({ code }) => {
        const values = new Set<string>();
        for (const row of translations[code] ?? []) {
            if (row.meaningId !== meaningId) continue;
            const value = row.value?.trim();
            if (value) values.add(value);
        }
        return { code, values: [...values] };
    });
}
