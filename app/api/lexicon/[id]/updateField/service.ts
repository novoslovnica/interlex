import {prismaData as prisma} from "@/lib/prisma";

// 1. Поля, которые разрешено обновлять во всех языковых таблицах
const ALLOWED_LANG_FIELDS = ["value", "veryfied", "wordId", "meaningId"] as const;

// 2. Строгий тип для доступных языковых кодов
export type LanguageCode =

    | "en" | "ru" | "mk" | "sr" | "uk" | "bg" | "pl" | "be"
    | "cs" | "sk" | "sl" | "hr" | "cu" | "de" | "nl" | "eo";

// 3. Карта моделей Prisma
export const modelsMap: Record<LanguageCode | string, any> = {
    // English
    en: prisma.en, En: prisma.en,
    // Russian
    ru: prisma.ru, Ru: prisma.ru,
    // Macedonian
    mk: prisma.mk, Mk: prisma.mk,
    // Serbian
    sr: prisma.sr, Sr: prisma.sr,
    // Ukrainian
    uk: prisma.uk, Uk: prisma.uk,
    // Bulgarian
    bg: prisma.bg, Bg: prisma.bg,
    // Polish
    pl: prisma.pl, Pl: prisma.pl,
    // Belarusian
    be: prisma.be, Be: prisma.be,
    // Czech
    cs: prisma.cs, Cs: prisma.cs,
    // Slovak
    sk: prisma.sk, Sk: prisma.sk,
    // Slovenian
    sl: prisma.sl, Sl: prisma.sl,
    // Croatian
    hr: prisma.hr, Hr: prisma.hr,
    // Church Slavic (Старославянский)
    cu: prisma.cu, Cu: prisma.cu,
    // German
    de: prisma.de, De: prisma.de,
    // Dutch
    nl: prisma.nl, Nl: prisma.nl,
    // Esperanto
    eo: prisma.eo, Eo: prisma.eo,
};


export const updateField = async (wordId: string, field: string, newValue: string) => {
    console.log(wordId, field, newValue);

    if (["nsl", "isv", "value"].includes(field)) {

        const updatedUser = await prisma.word.update({
            where: {
                id: parseInt(wordId),
            },
            data: {
                [field]: newValue,
            },
        });
        return updatedUser;
    }
    if (["en", "ru"].includes(field)) {
        const entityOne = await modelsMap[field].findFirst({
            where: {
                wordId: parseInt(wordId),
            }
        })
        console.log(entityOne);

        const updatedUser = await modelsMap[field].update({
            where: {
                id: entityOne.id,
            },
            data: {
                value: newValue,
            },
        });
        return updatedUser;
    }
    return null;
};
