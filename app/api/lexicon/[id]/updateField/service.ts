import {prismaData as prisma} from "@/lib/prisma";
import { auth } from "@/auth"
import { logAudit } from "@/lib/audit-log"
import { init } from "@/lib/sqlite"
import { upsertTranslation, TRANSLATION_LANGUAGE_CODES } from "@/lib/translations"

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

export const updateField = async (wordId: string, field: string, newValue: string, verified?: number, translationId?: number, message?: string, meaningId?: number) => {
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
            const oldVerified = existing?.verified ?? null

            if (existing) {
                await prisma.lexemeAllophone.update({
                    where: { id: existing.id },
                    data: {
                        value: newValue,
                        ...(verified !== undefined ? { verified } : {}),
                    },
                })
            } else {
                await prisma.lexemeAllophone.create({
                    data: {
                        lexemeId: parsedId,
                        flavorId: flavor.id,
                        type: "standard",
                        value: newValue,
                        ...(verified !== undefined ? { verified } : {}),
                    },
                })
            }

            const changes = [{ field, oldValue, newValue }]
            if (verified !== undefined && verified !== oldVerified) {
                changes.push({ field: `${field}.verified`, oldValue: oldVerified, newValue: verified })
            }
            await logAudit(session?.user, "Lexeme", parsedId, changes)
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

    const lang = field.toLowerCase();
    if ((TRANSLATION_LANGUAGE_CODES as readonly string[]).includes(lang)) {
        // Neither identifier available: previously this fell back to a
        // wordId-based lookup, which per investigation was already wrong for
        // 93% of hsb/dsb rows (and hundreds of others) — could silently
        // update the wrong meaning's translation. That fallback no longer
        // exists (translations are meaningId-scoped only); cleanly no-op
        // instead, matching the safe half of the old behavior.
        if (!translationId && !meaningId) return null;

        const db = await init();
        const { row, changes } = upsertTranslation(db, {
            id: translationId,
            meaningId,
            language: lang,
            value: newValue,
            verified,
            message,
        });

        if (changes.length > 0) {
            await logAudit(session?.user, "Lexeme", parseInt(wordId), changes)
        }
        return row;
    }
    return null;
};