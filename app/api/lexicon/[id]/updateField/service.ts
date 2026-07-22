import {prismaData as prisma} from "@/lib/prisma";
import { auth } from "@/auth"
import { logAudit, type FieldChange } from "@/lib/audit-log"

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
    async function getFlavorsForLexeme(lexemeId: number): Promise<string[]> {
        const allophones = await prisma.lexemeAllophone.findMany({
            where: { lexemeId },
            include: { flavor: true },
        })
        const flavors = allophones.map(a => a.flavor.code)
        return [...new Set(flavors)]
    }

    async function removeFromOldBase(base: string, id: number) {
        const entry = await prisma.baseHomonym.findUnique({ where: { base } })
        if (!entry) return

        const parsed = JSON.parse(entry.wordIds) as Array<{ id: number; flavors: string[] }> | number[]
        let filtered: Array<{ id: number; flavors: string[] }>
        if (typeof parsed[0] === 'number') {
            filtered = (parsed as number[]).filter((fid: number) => fid !== id).map(fid => ({ id: fid, flavors: [] }))
        } else {
            filtered = (parsed as Array<{ id: number; flavors: string[] }>).filter(item => item.id !== id)
        }

        if (filtered.length > 0) {
            await prisma.baseHomonym.update({
                where: { base },
                data: { wordIds: JSON.stringify(filtered) },
            })
        } else {
            await prisma.baseHomonym.delete({ where: { base } })
        }
    }

    async function addToNewBase(base: string, id: number) {
        const existing = await prisma.baseHomonym.findUnique({ where: { base } })
        const flavors = await getFlavorsForLexeme(id)

        if (existing) {
            const parsed = JSON.parse(existing.wordIds) as Array<{ id: number; flavors: string[] }> | number[]
            let items: Array<{ id: number; flavors: string[] }>
            if (typeof parsed[0] === 'number') {
                items = (parsed as number[]).map(fid => ({
                    id: fid,
                    flavors: fid === id ? flavors : [],
                }))
            } else {
                items = parsed as Array<{ id: number; flavors: string[] }>
            }

            const existingIdx = items.findIndex(item => item.id === id)
            if (existingIdx >= 0) {
                items[existingIdx].flavors = flavors
            } else {
                items.push({ id, flavors })
            }

            await prisma.baseHomonym.update({
                where: { base },
                data: { wordIds: JSON.stringify(items) },
            })
        } else {
            await prisma.baseHomonym.create({
                data: { base, wordIds: JSON.stringify([{ id, flavors }]) },
            })
        }
    }

    if (oldBase) await removeFromOldBase(oldBase, wordId)
    if (newBase) await addToNewBase(newBase, wordId)
}

export const updateField = async (wordId: string, field: string, newValue: string, veryfied?: number, translationId?: number, message?: string, meaningId?: number) => {
    const session = await auth()

    if (["stem", "nsl", "isv", "value", "external_id"].includes(field)) {
        const parsedId = parseInt(wordId)

        if (field === "stem") {
            const current = await prisma.lexeme.findUnique({ where: { id: parsedId } })
            const oldStem = current?.stem?.trim() || null
            const newStem = newValue.trim() || null

            await prisma.lexeme.update({
                where: { id: parsedId },
                data: { stem: newStem },
            })
            await logAudit(session?.user, "Lexeme", parsedId, [
                { field: "stem", oldValue: oldStem, newValue: newStem },
            ])

            await syncBaseHomonym(parsedId, newStem, oldStem)
        } else if (field === "isv" || field === "nsl") {
            const flavorCode = field === "isv" ? "CORE" : "NSL"
            const flavor = await prisma.allophoneFlavor.findUnique({ where: { code: flavorCode } })
            if (!flavor) throw new Error(`Allophone flavor ${flavorCode} not found`)

            const existing = await prisma.lexemeAllophone.findFirst({
                where: { lexemeId: parsedId, flavorId: flavor.id, type: "standard" },
            })
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

            await logAudit(session?.user, "Lexeme", parsedId, [
                { field, oldValue, newValue },
            ])
        } else {
            const current = await prisma.lexeme.findUnique({ where: { id: parsedId } })
            const oldValue = (current as Record<string, unknown> | null)?.[field] ?? null

            await prisma.lexeme.update({
                where: { id: parsedId },
                data: { [field]: newValue },
            })
            await logAudit(session?.user, "Lexeme", parsedId, [
                { field, oldValue, newValue },
            ])
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
            const findWhere: Record<string, unknown> = { wordId: parseInt(wordId) };
            if (meaningId) findWhere.meaningId = meaningId;
            entityOne = await langModel.findFirst({
                where: findWhere
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
                const created = await langModel.create({ data: createData });
                if (newValue || veryfied !== undefined || message !== undefined) {
                    await logAudit(session?.user, "Lexeme", parseInt(wordId), [
                        { field: `${field}.created`, oldValue: null, newValue: "new translation" },
                    ])
                }
                return created;
            }
            return null;
        }

        const updateData: Record<string, unknown> = {};
        const changes: FieldChange[] = [];

        if (veryfied !== undefined) {
            updateData.veryfied = veryfied;
            if ((entityOne?.veryfied ?? 0) !== veryfied) {
                changes.push({ field: `${field}.veryfied`, oldValue: entityOne?.veryfied ?? 0, newValue: veryfied });
            }
        }
        if (newValue !== undefined) {
            updateData.value = newValue;
            changes.push({ field: `${field}.value`, oldValue: entityOne?.value ?? null, newValue });
        }
        if (message !== undefined) {
            updateData.message = message;
            changes.push({ field: `${field}.message`, oldValue: entityOne?.message ?? null, newValue: message });
        }

        const updated = await langModel.update({
            where: { id: entityOne.id },
            data: updateData,
        });
        await logAudit(session?.user, "Lexeme", parseInt(wordId), changes)
        return updated;
    }
    return null;
};