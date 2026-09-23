// The bulk import capitalized the first letter of most translations in some
// languages although the words are common, not proper ("bely -> Белый",
// "ale -> Ale", "glava -> Głowa"). On the public review cards
// (/contribute) volunteers split over it and correct words get rejected.
//
// Lowercasing everything would be wrong ("egipet -> Египет" must stay), and
// Lexeme.properNoun cannot decide it: it is set on 508 lexemes but plainly
// missing on many place names and peoples. The evidence used instead is
// inside the data: in pl, cs, sk, hr, sl, uk, be the number of capitalized
// translations is about the number of proper nouns (~500 of ~19 000) - those
// languages were proofread. So, per MEANING:
//   - every translation available in those reference languages starts
//     lowercase, and there are at least MIN_REFERENCES of them
//       -> the concept is a common word -> a capitalized translation of the
//          same meaning in another language is an import artifact -> fix;
//   - any reference is capitalized, or there are too few -> leave alone.
// The reference languages capitalize MORE than the East/South Slavic targets
// do (Polak, Čech, Hrvat vs. поляк), so "all references lowercase" is the
// conservative direction: what it misses stays capitalized, it does not
// wrongly lowercase.
//
// Second tier, for meanings with too few references (newer lexemes that
// only have en/ru/sr/bg/mk/hsb/dsb translations): part of speech. A verb,
// adjective, adverb, pronoun, numeral, conjunction, adposition or particle is
// never capitalized in a Slavic language or Esperanto (adjectives from place
// names included: "московский", "pražský", "serbski"). Nouns get no second
// tier - without references a common noun cannot be told from a place name
// or a people - and stay for the review cards. English adjectives are
// excluded too ("Abazian").
//
// Guard against proper-noun translations of non-proper lexemes
// ("azerbajdzansky[ADJ] -> Azerbajdžan" in the machine-made hsb/dsb data): a
// variant is left alone if the same string is, in ANY language, the
// translation of something known to be proper (properNoun flag, or a meaning
// whose references are capitalized) - "altajsky[ADJ] -> Altaj" in dsb is
// caught by "Altaj" in pl/cs/sk. A row that would still contain a capital
// inside after the fix ("Peer-to-peer Network", "In Drei Teilen") is skipped
// whole: it is a title, a foreign phrase or a name, not a plain word.
//
// Per-language exceptions:
//   de      - skipped. German capitalizes every noun, and the variant list of
//             a VERB or ADJ lexeme routinely contains nouns ("stvarjati ->
//             schaffen sie, machen, Form", "altajsky -> Altai"). A first-word
//             infinitive check was tried and still produced "Wunde -> wunde",
//             "Bericht -> bericht" - not decidable without a German dictionary.
//   en      - also needs nl lowercase (Dutch, like English, capitalizes
//             nationality/language adjectives: "Belarusian"/"Belgisch"), and
//             days, months and "I" are excluded by list.
//   eo      - skipped: 346 candidate rows, a large share of them English
//             words or proper nouns given for an adjective ("sovetsky ->
//             Sovetio") - not worth the risk.
//   nl, cu  - skipped: nl is fully proofread, cu has 17 capitalized rows.
//
// The machine-made hsb/dsb/eo columns contain German and English strings
// left over from the import ("genocid -> Völkermord", "Lower Sorbian"). A
// variant equal to a German or English translation of the same meaning is
// left alone - lowercasing a German noun would only make the junk worse.
//
// Within a value every comma/semicolon-separated variant is handled on its
// own ("Срам, Стид" -> "срам, стид"); only the first letter of a variant
// changes; an all-caps variant (USA, VIP) is left alone.
//
// verified=1 rows are skipped unless --include-verified: the flag is mostly a
// bulk-import mark, but some rows were really checked by a moderator.
//
// --trust-proper-flag (maintainer's rule, 2026-09-19: "proper nouns have
// their own field, every other spelling is lowercase"). Applied to the parts
// of speech that cannot be a proper name at all - verb, adjective, adverb,
// pronoun, numeral, function words: there the evidence tiers above are
// skipped and verified=1 rows are included. It is deliberately NOT applied to
// nouns (nor to lexemes with no/unknown POS, PROPN, INTJ): Lexeme.properNoun
// is missing on roughly 13% of the capitalized nouns that remain (Уфа,
// Люблин, Кострома, Гамбург...), so trusting it there would lowercase real
// place and personal names. Nouns wait until properNoun has been reviewed
// by a person at /admin/proper-nouns. Limited to ru, uk, be, bg (and sr, mk minus
// adjectives): elsewhere the language's own orthography capitalizes words
// that are not proper nouns in the dictionary's sense - English "Jewish",
// "Christian", "Russify"; Croatian/Sorbian ethnonyms given as the
// translation of an adjective ("Atenjanka", "Athenčan").
//
// Run it until it reports 0: fixing an artifact in a reference language
// (22 such rows in uk) lets meanings it was holding back pass on the next run.
//
// Dry run by default. --apply writes, after a one-time VACUUM INTO backup
// (interlex.db.backup-before-capitalization). Each change gets an audit_logs
// row (userEmail 'script:normalize-capitalization', one actionId per lexeme),
// and the full change list is written to a JSON report for review/rollback.
// Votes on a changed translation are NOT reset (a case fix is not a new
// value to judge) - this writes translations.value directly, not through
// upsertTranslation. Lexeme.updatedAt is deliberately not touched: it drives
// corpus-refresh, and translations do not affect the corpus.
//
// Usage:
//   npx tsx scripts/db/2026-09-19-normalize-translation-capitalization.ts [--apply] [--include-verified] [--trust-proper-flag] [--lang=ru,en]

import Database from "better-sqlite3"
import { randomUUID } from "crypto"
import fs from "fs"
import path from "path"
import { isUpperLetter, firstLetter, isAllCaps, lowercaseVariants } from "../../lib/capitalization"

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
const APPLY = process.argv.includes("--apply")
const INCLUDE_VERIFIED = process.argv.includes("--include-verified")
const TRUST_PROPER_FLAG = process.argv.includes("--trust-proper-flag")
const ONLY_LANGUAGES = process.argv.find((arg) => arg.startsWith("--lang="))?.slice("--lang=".length).split(",")

const REFERENCE_LANGUAGES = ["pl", "cs", "sk", "hr", "sl", "uk", "be"]
const MIN_REFERENCES = 2
const SKIPPED_LANGUAGES = new Set(["nl", "cu", "de", "eo"])
const ENGLISH_ALWAYS_CAPITAL = new Set([
    "i", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
])

interface Row {
    id: number
    language: string
    value: string
    verified: number | null
    meaningId: number
    lexemeId: number
    isv: string | null
    pos: string | null
    properNoun: number | null
}

// Общие правила регистра - lib/capitalization.ts (их же использует /admin/proper-nouns).

console.log(`Target DB: ${DB_PATH}`)
console.log(`Mode: ${APPLY ? "APPLY" : "dry run"}${INCLUDE_VERIFIED ? ", including verified=1" : ""}${TRUST_PROPER_FLAG ? ", trusting properNoun for non-noun POS" : ""}${ONLY_LANGUAGES ? `, languages: ${ONLY_LANGUAGES.join(",")}` : ""}\n`)
const db = new Database(DB_PATH, { readonly: !APPLY })

const rows = db.prepare(`
    SELECT t.id, t.language, t.value, t.verified, t.meaningId, l.id AS lexemeId, l.value AS isv, l.pos, l.properNoun
    FROM translations t JOIN meanings m ON m.id = t.meaningId JOIN lexemes l ON l.id = m.lexemeId
    WHERE t.value IS NOT NULL AND TRIM(t.value) != ''
`).all() as Row[]

const byMeaning = new Map<number, Row[]>()
for (const row of rows) {
    const list = byMeaning.get(row.meaningId)
    if (list) list.push(row)
    else byMeaning.set(row.meaningId, [row])
}

const SLAVIC_AND_ESPERANTO = new Set(["ru", "uk", "be", "bg", "sr", "mk", "hr", "sl", "pl", "cs", "sk", "hsb", "dsb", "eo"])
const NEVER_CAPITALIZED_POS = new Set(["VERB", "AUX", "ADJ", "ADV", "PRON", "DET", "NUM", "CCONJ", "SCONJ", "ADP", "PART"])

type Reason = "fix" | "deliberate_inner_variant" | "fix_by_pos" | "foreign_language_junk" | "inner_capital" | "known_proper_string" | "noun_without_references" | "proper_noun_flag" | "reference_capitalized" | "too_few_references" | "verified"
    | "english_dutch_capitalized" | "english_always_capital" | "all_caps" | "language_skipped"
const tally: Record<string, Record<Reason, number>> = {}
const samples: Record<string, Partial<Record<Reason, string[]>>> = {}
const changes: { id: number; lexemeId: number; language: string; isv: string | null; oldValue: string; newValue: string }[] = []

// Сколько опорных ЯЗЫКОВ (не строк) дают значению заглавную и сколько -
// строчную. У значения бывает несколько строк одного языка, и рядом с
// вычитанной "ale, lecz" нередко лежит дубль-артефакт "Ale": язык считается
// "с заглавной", только если с заглавной ВСЕ его строки. Иначе артефакт в
// опорном языке блокировал бы исправление остальных (и самого себя).
function referenceEvidence(meaningId: number, exceptLanguage: string): { capitalized: number; lowercase: number } {
    const perLanguage = new Map<string, boolean>()
    for (const other of byMeaning.get(meaningId) ?? []) {
        if (other.language === exceptLanguage || !REFERENCE_LANGUAGES.includes(other.language)) continue
        const capital = isUpperLetter(firstLetter(other.value))
        perLanguage.set(other.language, (perLanguage.get(other.language) ?? true) && capital)
    }
    const capitalized = [...perLanguage.values()].filter(Boolean).length
    return { capitalized, lowercase: perLanguage.size - capitalized }
}

function decide(row: Row): Reason {
    if (SKIPPED_LANGUAGES.has(row.language)) return "language_skipped"
    // Артефакт заливки - заглавная у ПЕРВОГО варианта ("Ale, weto"). Если первый
    // вариант со строчной, а заглавная стоит дальше ("североморский, Северного
    // моря", "опет, стално, Јово наново"), её поставили осознанно.
    if (!isUpperLetter(firstLetter(row.value))) return "deliberate_inner_variant"
    if (row.properNoun) return "proper_noun_flag"
    if (isAllCaps(row.value)) return "all_caps"
    // Только языки, где с заглавной не пишут ни прилагательные, ни этнонимы
    // (ru, uk, be, bg); в sr/mk этнонимы с заглавной ("Србин"), а перевод
    // прилагательного нередко дан существительным - прилагательные там не трогаем.
    // Английский исключён: Jewish, Christian, Nazi, Freudian, Russify обязаны
    // быть с заглавной, и голландский тут не страховка (religie - со строчной).
    // hr/sk/pl/hsb/dsb исключены по той же причине, что sr/mk ("Atenjanka").
    if (TRUST_PROPER_FLAG && NEVER_CAPITALIZED_POS.has(row.pos ?? "")) {
        const plain = ["ru", "uk", "be", "bg"].includes(row.language)
        const withoutAdjectives = ["sr", "mk"].includes(row.language) && row.pos !== "ADJ"
        if (plain || withoutAdjectives) return "fix_by_pos"
    }
    if (row.verified === 1 && !INCLUDE_VERIFIED) return "verified"

    const siblings = byMeaning.get(row.meaningId) ?? []
    const evidence = referenceEvidence(row.meaningId, row.language)
    if (evidence.capitalized > 0) return "reference_capitalized"
    const byReferences = evidence.lowercase >= MIN_REFERENCES
    if (!byReferences) {
        const pos = row.pos ?? ""
        if (pos === "NOUN" || pos === "PROPN") return "noun_without_references"
        const posAllowed = NEVER_CAPITALIZED_POS.has(pos) && (SLAVIC_AND_ESPERANTO.has(row.language) || (row.language === "en" && pos !== "ADJ"))
        if (!posAllowed) return "too_few_references"
    }

    if (row.language === "en") {
        if (siblings.some((other) => other.language === "nl" && isUpperLetter(firstLetter(other.value)))) return "english_dutch_capitalized"
        const firstWord = row.value.trim().split(/[\s,;(!?.]/)[0].toLowerCase()
        if (ENGLISH_ALWAYS_CAPITAL.has(firstWord)) return "english_always_capital"
    }
    return byReferences ? "fix" : "fix_by_pos"
}

// Первый проход: строки, про которые известно, что они собственные.
// Строки, про которые известно, что они собственные: лексема с флагом
// properNoun либо значение, у которого с заглавной ВСЕ опорные языки (и их
// не меньше MIN_REFERENCES). "Хоть один опорный с заглавной" сюда не годится:
// так в набор попадал артефакт "Ale" и блокировал сам себя.
const knownProper = new Set<string>()
for (const row of rows) {
    if (!isUpperLetter(firstLetter(row.value))) continue
    const evidence = referenceEvidence(row.meaningId, "")
    if (!row.properNoun && !(evidence.lowercase === 0 && evidence.capitalized >= MIN_REFERENCES)) continue
    for (const variant of row.value.split(/[,;/]/)) knownProper.add(variant.trim())
}

for (const row of rows) {
    if (ONLY_LANGUAGES && !ONLY_LANGUAGES.includes(row.language)) continue
    // Интересны только значения, где с заглавной начинается хотя бы один вариант.
    const normalized = lowercaseVariants(row.value)
    if (normalized === row.value) continue

    let reason = decide(row)
    let fixed = normalized
    if (reason === "fix" || reason === "fix_by_pos") {
        // Иноязычный мусор заливки: строка пропускается ЦЕЛИКОМ, если хоть один
        // её вариант совпал с немецким/английским переводом того же значения
        // (список немецких синонимов редко совпадает весь) или в ней есть
        // буквы, которых нет ни в одном из этих алфавитов.
        if (row.language !== "en") {
            const own = row.value.split(/[,;/]/).map((part) => part.trim().toLowerCase())
            const foreign = (byMeaning.get(row.meaningId) ?? [])
                .filter((other) => other.language === "de" || other.language === "en")
                .flatMap((other) => other.value.split(/[,;/]/).map((part) => part.trim().toLowerCase()))
            if (/[äöüßÄÖÜ]/.test(row.value) || own.some((part) => part !== "" && foreign.includes(part))) reason = "foreign_language_junk"
        }
        if (reason !== "foreign_language_junk") {
            fixed = lowercaseVariants(row.value, knownProper)
            if (fixed === row.value) reason = "known_proper_string"
            else if (/[\s-]\p{Lu}/u.test(fixed)) reason = "inner_capital"
        }
    }
    const languageTally = (tally[row.language] ??= {} as Record<Reason, number>)
    languageTally[reason] = (languageTally[reason] ?? 0) + 1
    const bucket = ((samples[row.language] ??= {})[reason] ??= [])
    if (bucket.length < 5 && Math.random() < 0.05) bucket.push(reason.startsWith("fix") ? `${row.isv}[${row.pos}] → ${row.value} ⇒ ${fixed}` : `${row.isv}[${row.pos}] → ${row.value}`)
    if (reason === "fix" || reason === "fix_by_pos") changes.push({ id: row.id, lexemeId: row.lexemeId, language: row.language, isv: row.isv, oldValue: row.value, newValue: fixed })
}

console.table(Object.fromEntries(Object.entries(tally).sort((a, b) => ((b[1].fix ?? 0) + (b[1].fix_by_pos ?? 0)) - ((a[1].fix ?? 0) + (a[1].fix_by_pos ?? 0)))))
for (const [language, byReason] of Object.entries(samples)) {
    for (const [reason, list] of Object.entries(byReason)) {
        if (list && list.length > 0) console.log(`${language} / ${reason}:\n    ${list.join("\n    ")}`)
    }
}
console.log(`\nTo fix: ${changes.length} translations across ${new Set(changes.map((change) => change.lexemeId)).size} lexemes`)

// Метка времени: исправление опорного языка открывает вторую волну (значение,
// которое держал с заглавной артефакт в uk, после его правки проходит правило),
// и второй --apply не должен затирать отчёт первого - это запись для отката.
const reportPath = path.resolve(process.cwd(), `translation-capitalization-report-${APPLY ? new Date().toISOString().replace(/[:.]/g, "-") : "dryrun"}.json`)
fs.writeFileSync(reportPath, JSON.stringify(changes, null, 1))
console.log(`Full change list: ${reportPath}`)

if (!APPLY) {
    console.log("\nDry run - nothing written. Re-run with --apply to write.")
    db.close()
    process.exit(0)
}

const BACKUP_PATH = `${DB_PATH}.backup-before-capitalization`
if (!fs.existsSync(BACKUP_PATH)) {
    console.log(`\nBacking up to ${BACKUP_PATH} ...`)
    db.exec(`VACUUM INTO '${BACKUP_PATH.replace(/'/g, "''")}'`)
}

const update = db.prepare(`UPDATE translations SET value = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND value = ?`)
const audit = db.prepare(`
    INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail)
    VALUES (?, 'Lexeme', ?, ?, ?, ?, NULL, 'script:normalize-capitalization')
`)
let written = 0
db.transaction(() => {
    const actionIds = new Map<number, string>()
    for (const change of changes) {
        // AND value = ? - не перезаписать строку, которую кто-то успел поправить после чтения.
        if (update.run(change.newValue, change.id, change.oldValue).changes === 0) continue
        let actionId = actionIds.get(change.lexemeId)
        if (!actionId) actionIds.set(change.lexemeId, (actionId = randomUUID()))
        audit.run(actionId, change.lexemeId, `${change.language}.value`, change.oldValue, change.newValue)
        written++
    }
})()
console.log(`Written: ${written} translations (audit rows: ${written}).`)
db.close()
