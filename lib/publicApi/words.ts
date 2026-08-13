import type Database from "better-sqlite3"
import { init } from "@/lib/sqlite"
import { prismaData } from "@/lib/prisma"
import { fetchTranslationsForMeaningIds, TRANSLATION_LANGUAGE_CODES } from "@/lib/translations"

export interface PublicWord {
    slug: string
    value: string | null
    transcription: string | null
    mainCategory: string | null
    usageType: string | null
    pos: string | null
    gender: string | null
    aspect: string | null
    transitivity: string | null
    animacy: string | null
    degree: string | null
    pronType: string | null
    numType: string | null
    frequency: string | null
    intelligibility: string | null
    etymology: string | null
    proto: string | null
    paradigm: string | null
    protoStemClass: string | null
    stemExtension: string | null
    corpusFrequency: number | null
    corpusFrequencyPerMln: number | null
    corpusRank: number | null
    corpusHapax: boolean | null
    distributionD: number | null
    cefrLevel: string | null
    properNoun: boolean
    isCollocation: boolean
}

// This intentionally does NOT include hasAnomalies, stressPosition,
// external_id, createdAt/updatedAt, or isPublic itself - internal QA/
// grammar-engine/housekeeping fields with no public value. It also does not
// take an `includeHidden`-style parameter at all (unlike the internal
// getDictItems()), so there is no code path that could accidentally expose
// hidden lexemes.
const PUBLIC_WORD_COLUMNS = `
    l.slug, l.value, l.transcription, l.mainCategory, l.usageType, l.pos, l.gender, l.aspect,
    l.transitivity, l.animacy, l.degree, l.pronType, l.numType, l.frequency, l.intelligibility,
    l.etymology, l.proto, l.paradigm, l.protoStemClass, l.stemExtension,
    l.corpusFrequency, l.corpusFrequencyPerMln, l.corpusRank, l.corpusHapax,
    l.distributionD, l.cefrLevel, l.properNoun, l.isCollocation
`

interface PublicWordRow {
    slug: string
    value: string | null
    transcription: string | null
    mainCategory: string | null
    usageType: string | null
    pos: string | null
    gender: string | null
    aspect: string | null
    transitivity: string | null
    animacy: string | null
    degree: string | null
    pronType: string | null
    numType: string | null
    frequency: string | null
    intelligibility: string | null
    etymology: string | null
    proto: string | null
    paradigm: string | null
    protoStemClass: string | null
    stemExtension: string | null
    corpusFrequency: number | null
    corpusFrequencyPerMln: number | null
    corpusRank: number | null
    corpusHapax: number | null
    distributionD: number | null
    cefrLevel: string | null
    properNoun: number
    isCollocation: number
}

function toPublicWord(row: PublicWordRow): PublicWord {
    return {
        ...row,
        corpusHapax: row.corpusHapax == null ? null : row.corpusHapax === 1,
        properNoun: row.properNoun === 1,
        isCollocation: row.isCollocation === 1,
    }
}

/**
 * Reuses getDictItems()'s (app/api/lexicon/services.ts) FTS5-then-LIKE
 * search technique, but is its own leaner query - not a call into
 * getDictItems, which returns many internal-only fields/shape not meant for
 * an external contract. `l.isPublic = 1` is hardcoded in every branch below.
 */
export async function searchPublicWords(
    search: string,
    limit: number,
    offset: number,
): Promise<{ items: PublicWord[]; total: number }> {
    const db: Database.Database = await init()

    if (search) {
        const useFts = search.length >= 3
        const searchOp = useFts ? "MATCH ?" : "LIKE ? ESCAPE '\\'"
        const searchParam = useFts
            ? `"${search.replace(/"/g, '""')}"`
            : `%${search.replace(/[%_]/g, "\\$&")}%`

        const matchClause = `
            l.isPublic = 1
            AND (
                l.id IN (SELECT ROWID FROM lexemes_text WHERE value ${searchOp})
                OR EXISTS (
                    SELECT 1 FROM lexeme_allophones la
                    WHERE la.lexemeId = l.id
                    AND la.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE')
                    AND la.type = 'standard'
                    AND la.id IN (SELECT ROWID FROM lexeme_allophones_text WHERE value ${searchOp})
                )
            )
        `

        const total = (
            db.prepare(`SELECT COUNT(DISTINCT l.id) c FROM lexemes l WHERE ${matchClause}`)
                .get(searchParam, searchParam) as { c: number }
        ).c

        const rows = db.prepare(`
            SELECT DISTINCT ${PUBLIC_WORD_COLUMNS}
            FROM lexemes l
            WHERE ${matchClause}
            ORDER BY l.id ASC
            LIMIT ? OFFSET ?
        `).all(searchParam, searchParam, limit, offset) as PublicWordRow[]

        return { items: rows.map(toPublicWord), total }
    }

    const total = (db.prepare(`SELECT COUNT(*) c FROM lexemes WHERE isPublic = 1`).get() as { c: number }).c
    const rows = db.prepare(`
        SELECT ${PUBLIC_WORD_COLUMNS} FROM lexemes l WHERE l.isPublic = 1 ORDER BY l.id ASC LIMIT ? OFFSET ?
    `).all(limit, offset) as PublicWordRow[]

    return { items: rows.map(toPublicWord), total }
}

export interface PublicTranslation {
    language: string
    value: string
    verified: boolean
}

export interface PublicMeaning {
    meaning: string | null
    examples: string | null
    verified: boolean
    examplesVerified: boolean
    translations: PublicTranslation[]
}

export interface PublicWordDetail extends PublicWord {
    meanings: PublicMeaning[]
}

/**
 * Must filter isPublic:true explicitly - unlike the existing internal
 * app/api/lexicon/by-slug/[slug]/route.ts, which has NO such filter by
 * design (hidden lexemes stay reachable by direct link for logged-in
 * editors). Copying that handler here would leak moderation-hidden entries
 * through the public API.
 */
export async function getPublicWordBySlug(slug: string): Promise<PublicWordDetail | null> {
    const lexeme = await prismaData.lexeme.findFirst({
        where: { slug, isPublic: true },
        select: {
            slug: true, value: true, transcription: true, mainCategory: true, usageType: true,
            pos: true, gender: true, aspect: true, transitivity: true, animacy: true, degree: true,
            pronType: true, numType: true, frequency: true, intelligibility: true, etymology: true,
            proto: true, paradigm: true, protoStemClass: true, stemExtension: true,
            corpusFrequency: true, corpusFrequencyPerMln: true, corpusRank: true, corpusHapax: true,
            distributionD: true, cefrLevel: true, properNoun: true, isCollocation: true,
            meanings: {
                select: { id: true, meaning: true, examples: true, meaningVerified: true, examplesVerified: true },
            },
        },
    })
    if (!lexeme) return null

    const meaningIds = lexeme.meanings.map((m) => m.id)
    const db: Database.Database = await init()
    // Same file (interlex.db) accessed through two clients (Prisma above,
    // raw sqlite here) for historical/technique reasons - not a cross-
    // *database* boundary violation (that rule is about the 4 separate
    // SQLite files, not about mixing access styles to one of them).
    const translationsByLanguage = fetchTranslationsForMeaningIds(db, meaningIds, [...TRANSLATION_LANGUAGE_CODES])

    const meanings: PublicMeaning[] = lexeme.meanings.map((m) => {
        const translations: PublicTranslation[] = []
        for (const language of TRANSLATION_LANGUAGE_CODES) {
            const rows = translationsByLanguage[language]?.[m.id] ?? []
            for (const row of rows) {
                if (!row.value) continue
                translations.push({ language, value: row.value, verified: row.verified === 1 })
            }
        }
        return {
            meaning: m.meaning,
            examples: m.examples,
            verified: m.meaningVerified === 1,
            examplesVerified: m.examplesVerified === 1,
            translations,
        }
    })

    return {
        slug: lexeme.slug,
        value: lexeme.value,
        transcription: lexeme.transcription,
        mainCategory: lexeme.mainCategory,
        usageType: lexeme.usageType,
        pos: lexeme.pos,
        gender: lexeme.gender,
        aspect: lexeme.aspect,
        transitivity: lexeme.transitivity,
        animacy: lexeme.animacy,
        degree: lexeme.degree,
        pronType: lexeme.pronType,
        numType: lexeme.numType,
        frequency: lexeme.frequency,
        intelligibility: lexeme.intelligibility,
        etymology: lexeme.etymology,
        proto: lexeme.proto,
        paradigm: lexeme.paradigm,
        protoStemClass: lexeme.protoStemClass,
        stemExtension: lexeme.stemExtension,
        corpusFrequency: lexeme.corpusFrequency,
        corpusFrequencyPerMln: lexeme.corpusFrequencyPerMln,
        corpusRank: lexeme.corpusRank,
        corpusHapax: lexeme.corpusHapax,
        distributionD: lexeme.distributionD,
        cefrLevel: lexeme.cefrLevel,
        properNoun: lexeme.properNoun,
        isCollocation: lexeme.isCollocation,
        meanings,
    }
}
