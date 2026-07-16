import {prismaData as prisma} from "@/lib/prisma";
import { auth } from "@/auth"
import { buildEntry, append } from "@/lib/action-history"

const ALLOWED_LANG_FIELDS = ["value", "veryfied", "wordId", "meaningId"] as const;

export type LanguageCode =

    | "en" | "ru" | "mk" | "sr" | "uk" | "bg" | "pl" | "be"
    | "cs" | "sk" | "sl" | "hr" | "hsb" | "dsb" | "cu" | "de" | "nl" | "eo";

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
    hsb: prisma.hsb, Hsb: prisma.hsb,
    dsb: prisma.dsb, Dsb: prisma.dsb,
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

export const updateField = async (wordId: string, field: string, newValue: string, veryfied?: number, translationId?: number, message?: string, meaningId?: number) => {
    console.log(wordId, field, newValue, veryfied);
    const session = await auth()
    const author = session?.user?.email || "unknown"

    if (["stem", "nsl", "isv", "value"].includes(field)) {
        const parsedId = parseInt(wordId)

        if (field === "stem") {
            const current = await prisma.lexeme.findUnique({ where: { id: parsedId } })
            const currentWithHistory = current as { stem?: string | null; actionHistory?: string | null } | null
            const oldStem = current?.stem?.trim() || null
            const newStem = newValue.trim() || null

            await prisma.lexeme.update({
                where: { id: parsedId },
                data: {
                    stem: newStem,
                    actionHistory: append(currentWithHistory?.actionHistory, buildEntry(author, {
                        stem: { old: oldStem, new: newStem },
                    })),
                },
            })

            await syncBaseHomonym(parsedId, newStem, oldStem)
        } else if (field === "isv" || field === "nsl") {
            const flavorCode = field === "isv" ? "CORE" : "NSL"
            const flavor = await prisma.allophoneFlavor.findUnique({ where: { code: flavorCode } })
            if (!flavor) throw new Error(`Allophone flavor ${flavorCode} not found`)

            const existing = await prisma.lexemeAllophone.findFirst({
                where: { lexemeId: parsedId, flavorId: flavor.id, type: "standard" },
            })

            const current = await prisma.lexeme.findUnique({ where: { id: parsedId } })
            const currentWithHistory = current as { actionHistory?: string | null } | null
            const oldValue = existing?.value ?? null

            if (existing) {
                await prisma.lexemeAllophone.update({
                    where: { id: existing.id },
                    data: {
                        value: newValue,
                    },
                })
            } else {
                await prisma.lexemeAllophone.create({
                    data: {
                        lexemeId: parsedId,
                        flavorId: flavor.id,
                        type: "standard",
                        value: newValue,
                    },
                })
            }

            await prisma.lexeme.update({
                where: { id: parsedId },
                data: {
                    actionHistory: append(currentWithHistory?.actionHistory, buildEntry(author, {
                        [field]: { old: oldValue, new: newValue },
                    })),
                },
            })
        } else {
            const current = await prisma.lexeme.findUnique({ where: { id: parsedId } })
            const currentWithHistory = current as { [key: string]: unknown } | null
            const oldValue = currentWithHistory?.[field] ?? null

            await prisma.lexeme.update({
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

    const langModel = modelsMap[field];
    if (langModel) {
        let entityOne;

        if (translationId) {
            entityOne = await langModel.findUnique({
                where: { id: translationId }
            });
        } else {
            entityOne = await langModel.findFirst({
                where: { wordId: parseInt(wordId) }
            });
        }
        if (!entityOne) {
            if (meaningId) {
                const createData: Record<string, unknown> = {
                    wordId: parseInt(wordId),
                    meaningId: meaningId,
                };
                if (veryfied !== undefined) createData.veryfied = veryfied;
                if (newValue) createData.value = newValue;
                if (message !== undefined) createData.message = message;
                if (newValue || veryfied !== undefined || message !== undefined) {
                    createData.actionHistory = buildEntry(author, { created: { old: null, new: "new translation" } });
                }
                const created = await langModel.create({ data: createData });
                return created;
            }
            return null;
        }

        const updateData: Record<string, unknown> = {};

        const changes: Record<string, { old: unknown; new: unknown }> = {};

        if (veryfied !== undefined) {
            updateData.veryfied = veryfied;
            if ((entityOne?.veryfied ?? 0) !== veryfied) {
                changes.veryfied = { old: entityOne?.veryfied ?? 0, new: veryfied };
            }
        }
        if (newValue !== undefined) {
            updateData.value = newValue;
            changes.value = { old: entityOne?.value ?? null, new: newValue };
        }
        if (message !== undefined) {
            updateData.message = message;
            changes.message = { old: entityOne?.message ?? null, new: message };
        }

        if (Object.keys(changes).length > 0) {
            updateData.actionHistory = append(entityOne?.actionHistory, buildEntry(author, changes));
        }

        const updated = await langModel.update({
            where: { id: entityOne.id },
            data: updateData,
        });
        return updated;
    }
    return null;
};