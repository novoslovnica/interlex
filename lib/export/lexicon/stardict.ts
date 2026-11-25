import AdmZip from "adm-zip"
import type Database from "better-sqlite3"
import { setImmediate } from "node:timers/promises"
import { latinToCyrillic, toStandardLatin } from "@/lib/orthography/standard"
import { publicLexiconRows, type PublicLexiconRow } from "./publicRows"

export const STARDICT_ARCHIVE = "interlex-stardict.zip"
const basename = "interlex"
const maxKeyBytes = 255

interface Key {
    bytes: Buffer
    folded: Buffer
}
interface Article {
    key: Key
    aliases: Key[]
    text: Buffer
}

function lookupKey(value: string | null): Key | null {
    if (!value || /[\0\r\n]/.test(value)) return null
    const word = value.trim().normalize("NFC")
    const bytes = Buffer.from(word, "utf8")
    if (bytes.length === 0 || bytes.length > maxKeyBytes) return null
    // StarDict uses g_ascii_strcasecmp() with a bytewise strcmp() tie-break.
    const folded = Buffer.from(word.replace(/[A-Z]/g, ch => ch.toLowerCase()), "utf8")
    return { bytes, folded }
}

function compareKeys(a: Key, b: Key): number {
    return Buffer.compare(a.folded, b.folded) || Buffer.compare(a.bytes, b.bytes)
}

function articleText(rows: PublicLexiconRow[], word: string): Buffer {
    const senses = new Map<number, { definition: string; translations: Map<string, Set<string>> }>()
    for (const row of rows) {
        if (row.meaningId === null) continue
        let sense = senses.get(row.meaningId)
        if (!sense) {
            sense = { definition: row.meaning?.trim() ?? "", translations: new Map() }
            senses.set(row.meaningId, sense)
        }
        if (!row.language || !row.translation?.trim()) continue
        const values = sense.translations.get(row.language) ?? new Set<string>()
        values.add(row.translation.trim())
        sense.translations.set(row.language, values)
    }

    const sections = [rows[0].pos || word]
    let number = 0
    for (const { definition, translations } of senses.values()) {
        const lines = [...translations].map(([language, values]) => `${language}: ${[...values].join("; ")}`)
        if (!definition && !lines.length) continue
        number++
        sections.push([`${number}.${definition ? " " + definition : ""}`, ...lines].join("\n"))
    }
    return Buffer.from(sections.join("\n\n").replaceAll("\0", ""), "utf8")
}

function collectArticle(rows: PublicLexiconRow[], articles: Article[]) {
    if (!rows.length) return
    const { core, searchKey } = rows[0]
    const key = lookupKey(core) ?? lookupKey(searchKey)
    if (!key) return

    const word = key.bytes.toString("utf8")
    const alternatives = new Set([toStandardLatin(word), latinToCyrillic(word)])
    const aliases = [...alternatives].flatMap(value => {
        const alias = value === word ? null : lookupKey(value)
        return alias ? [alias] : []
    })
    articles.push({ key, aliases, text: articleText(rows, word) })
}

function encodeRecord(key: Key, numbers: number[]): Buffer {
    // The zero-filled separator terminates the UTF-8 key. Numeric fields are big-endian.
    const record = Buffer.alloc(key.bytes.length + 1 + numbers.length * 4)
    key.bytes.copy(record)
    numbers.forEach((value, index) => record.writeUInt32BE(value, key.bytes.length + 1 + index * 4))
    return record
}

/** .ifo/.idx/.dict plus .syn aliases, using the 32-bit StarDict 2.4.2 format. */
export async function buildStardict(db: Database.Database): Promise<AdmZip> {
    const articles: Article[] = []
    let rows: PublicLexiconRow[] = []
    let processed = 0
    for (const row of publicLexiconRows(db)) {
        if (rows.length && row.lexemeId !== rows[0].lexemeId) {
            collectArticle(rows, articles)
            rows = []
        }
        rows.push(row)
        // The SQLite cursor is synchronous. Let the server handle other requests between batches.
        if (++processed % 2048 === 0) await setImmediate()
    }
    collectArticle(rows, articles)
    articles.sort((a, b) => compareKeys(a.key, b.key))

    let offset = 0
    const index: Buffer[] = []
    const articlesData: Buffer[] = []
    const aliases: { key: Key; articleIndex: number }[] = []
    for (const [articleIndex, { key, text, aliases: articleAliases }] of articles.entries()) {
        index.push(encodeRecord(key, [offset, text.length]))
        articlesData.push(text)
        offset += text.length
        for (const alias of articleAliases) aliases.push({ key: alias, articleIndex })
    }
    aliases.sort((a, b) => compareKeys(a.key, b.key))

    const indexData = Buffer.concat(index)
    const metadata = [
        "StarDict's dict ifo file",
        "version=2.4.2",
        "bookname=Interslavic Lexicon",
        `wordcount=${articles.length}`,
        `idxfilesize=${indexData.length}`,
        ...(aliases.length ? [`synwordcount=${aliases.length}`] : []),
        "sametypesequence=m",
        "",
    ].join("\n")
    const zip = new AdmZip()
    zip.addFile(`${basename}.ifo`, Buffer.from(metadata, "utf8"))
    zip.addFile(`${basename}.idx`, indexData)
    zip.addFile(`${basename}.dict`, Buffer.concat(articlesData, offset))
    if (aliases.length) {
        zip.addFile(`${basename}.syn`, Buffer.concat(aliases.map(({ key, articleIndex }) => encodeRecord(key, [articleIndex]))))
    }
    return zip
}
