import { describe, expect, it } from "vitest";
import { TRANSLATION_LANGUAGES } from "@/config/features";
import { getMeaningTranslationRows } from "./meaningTranslations";

describe("getMeaningTranslationRows", () => {
    const translations = {
        ru: [
            { meaningId: 10, value: "ключ" },
            { meaningId: 11, value: "родник" },
            { meaningId: 10, value: " отмычка " },
            { meaningId: 10, value: "ключ " },
            { meaningId: null, value: "старый перевод" },
        ],
        pl: [
            { meaningId: 10, value: "klucz" },
            { meaningId: 11, value: "źródło" },
        ],
        cs: [
            { meaningId: 10, value: null },
            { meaningId: 10, value: " " },
        ],
    };

    it("keeps every distinct translation of the selected meaning", () => {
        const translated = getMeaningTranslationRows(translations, 10).filter(({ values }) => values.length);
        expect(translated).toEqual([
            { code: "ru", values: ["ключ", "отмычка"] },
            { code: "pl", values: ["klucz"] },
        ]);
        expect(getMeaningTranslationRows(translations, 11).find(({ code }) => code === "ru")?.values).toEqual(["родник"]);
    });

    it("retains every supported language when the meaning has no translations", () => {
        expect(getMeaningTranslationRows(translations, 12)).toEqual(
            TRANSLATION_LANGUAGES.map(({ code }) => ({ code, values: [] })),
        );
    });
});
