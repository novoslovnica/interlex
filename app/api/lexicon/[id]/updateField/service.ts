import {prismaData as prisma} from "@/lib/prisma";
import { auth } from "@/auth"
import { buildEntry, append } from "@/lib/action-history"

const ALLOWED_LANG_FIELDS = ["value", "veryfied", "wordId", "meaningId"] as const;

export type LanguageCode =

    | "en" | "ru" | "mk" | "sr" | "uk" | "bg" | "pl" | "be"
    | "cs" | "sk" | "sl" | "hr" | "cu" | "de" | "nl" | "eo";

export const modelsMap: Record<LanguageCode | string, any> = {
    en: prisma.en, En: prisma.en,
    ru: prisma.ru, Ru: prisma.ru,
    mk: prisma.mk, Mk: prisma.mk,
    sr: prisma.sr, Sr: prisma.sr,
    uk: prisma.uk, Uk: prisma.uk,
    bg: prisma.bg, Bg: prisma.bg,
    pl: prisma.pl, Pl: prisma.pl,
    be: prisma.be, Be: prisma.be,
    cs: prisma.cs, Cs: prisma.cs,
    sk: prisma.sk, Sk: prisma.sk,
    sl: prisma.sl, Sl: prisma.sl,
    hr: prisma.hr, Hr: prisma.hr,
    cu: prisma.cu, Cu: prisma.cu,
    de: prisma.de, De: prisma.de,
    nl: prisma.nl, Nl: prisma.nl,
    eo: prisma.eo, Eo: prisma.eo,
};

async function syncBaseHomonym(wordId: number, newBase: string | null, oldBase: string | null) {
    if (oldBase) {
        const oldEntry = await prisma.baseHomonym.findUnique({ where: { base: oldBase } })
        if (oldEntry) {
            const ids: number[] = JSON.parse(oldEntry.wordIds).filter((id: number) => id !== wordId)
            if (ids.length > 0) {
                await prisma.baseHomonym.update({
                    where: { base: oldBase },
                    data: { wordIds: JSON.stringify(ids) },
                })
            } else {
                await prisma.baseHomonym.delete({ where: { base: oldBase } })
            }
        }
    }
    if (newBase) {
        const existing = await prisma.baseHomonym.findUnique({ where: { base: newBase } })
        if (existing) {
            const ids: number[] = JSON.parse(existing.wordIds)
            if (!ids.includes(wordId)) {
                ids.push(wordId)
                await prisma.baseHomonym.update({
                    where: { base: newBase },
                    data: { wordIds: JSON.stringify(ids) },
                })
            }
        } else {
            await prisma.baseHomonym.create({
                data: { base: newBase, wordIds: JSON.stringify([wordId]) },
            })
        }
    }
}

export const updateField = async (wordId: string, field: string, newValue: string) => {
    console.log(wordId, field, newValue);
    const session = await auth()
    const author = session?.user?.email || "unknown"

    if (["base", "nsl", "isv", "value"].includes(field)) {
        const parsedId = parseInt(wordId)

        if (field === "base") {
            const current = await prisma.word.findUnique({ where: { id: parsedId } })
            const currentWithHistory = current as { base?: string | null; actionHistory?: string | null } | null
            const oldBase = current?.base?.trim() || null
            const newBase = newValue.trim() || null

            await prisma.word.update({
                where: { id: parsedId },
                data: {
                    base: newBase,
                    actionHistory: append(currentWithHistory?.actionHistory, buildEntry(author, {
                        base: { old: oldBase, new: newBase },
                    })),
                },
            })

            await syncBaseHomonym(parsedId, newBase, oldBase)
        } else {
            const current = await prisma.word.findUnique({ where: { id: parsedId } })
            const currentWithHistory = current as { [key: string]: unknown } | null
            const oldValue = currentWithHistory?.[field] ?? null

            await prisma.word.update({
                where: { id: parsedId },
                data: {
                    [field]: newValue,
                    actionHistory: append(currentWithHistory?.actionHistory as string | null | undefined, buildEntry(author, {
                        [field]: { old: oldValue, new: newValue },
                    })),
                },
            })
        }

        return;
    }
    if (["en", "ru"].includes(field)) {
        const entityOne = await modelsMap[field].findFirst({
            where: {
                wordId: parseInt(wordId),
            }
        })
        console.log(entityOne);

        const oldValue = entityOne?.value ?? null

        const updatedUser = await modelsMap[field].update({
            where: {
                id: entityOne.id,
            },
            data: {
                value: newValue,
                actionHistory: append(entityOne?.actionHistory, buildEntry(author, {
                    value: { old: oldValue, new: newValue },
                })),
            },
        });
        return updatedUser;
    }
    return null;
};