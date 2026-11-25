import { createHash, randomUUID } from "node:crypto"
import { resolve } from "node:path"
import Database from "better-sqlite3"
import { normalizeSurfaceForm } from "@/lib/corpus/surfaceForm"
import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"
import { expandVariants } from "@/lib/corpus/tokenizer/lexemeVariants"

const actor = "script:stage-reviewed-corpus-lexemes"
const nouns = [
    { value: "koeficient", evidence: [
        { id: 11352188, form: "koeficient", document: "ekonomika-e12e9617", hash: "2e0d53f0ebe9186c238da84c96bc77ae72df398ee584b1b76499543a2a8b0aa2" },
        { id: 15498354, form: "koeficientom", document: "noether-papers1-43-paper06", hash: "6a29becf721828161b8220ec5c86e78e69358e69f0cc388f750edb0cb1c5aab2" },
    ] },
    { value: "relacija", evidence: [
        { id: 11678460, form: "relacija", document: "iswiki-2293", hash: "a27c6609d21beb0a0f840e97c82aacecf3ff45e0e0fe9a98397cd839a20c6774" },
        { id: 15486952, form: "relacijeju", document: "noether-papers1-43-paper04", hash: "7abe204e6484c8034f5fa3213b4bb8c485e43a55e7b9e96a0647b7ebc4a66bdb" },
    ] },
    { value: "koncept", evidence: [
        { id: 11158874, form: "koncept", document: "bog-ca676e96", hash: "61a154dfe179129f5254275fa6feb665eae63daeaf64afc50590d8340a20f429" },
        { id: 11475896, form: "koncepty", document: "iswiki-1446", hash: "5533fc15d3cade7d29e9c1fd1318831c5f8e97800f44072dedae1b62cb712283" },
    ] },
    { value: "prefekt", evidence: [
        { id: 11525010, form: "prefekt", document: "iswiki-1622", hash: "ba5918f2ad97e3b3b0ea2553110a7b1bd18135da65dddd87f419602411ec4cc9" },
        { id: 12091966, form: "prefektom", document: "lev-xiv-59eb33c8", hash: "563268d0d91beac5bcafa577d0d2dd007c585215c61764f0ddc69a5d9f198b1d" },
    ] },
    { value: "ikanje", evidence: [
        { id: 13344474, form: "ikanje", document: "messages-discord-be830055", hash: "b50b4b5ac5e978f78a709e8a84b6140c5a69195b7afbcdc14635d7a75604dd9e" },
        { id: 13235192, form: "ikanja", document: "messages-discord-b78f27b4", hash: "bf5f4773974d7f56b1eff0776929e1d45ebefe5d03dc8a8d682a38068c6f374e" },
    ] },
    { value: "sadženje", evidence: [
        { id: 11536239, form: "sadženje", document: "iswiki-1660", hash: "dfd01c99f451a19164c3defb2877519876967c0f339bb465e27384520dbf93ef" },
        { id: 14975470, form: "sadženje", document: "messages-telegram-fd7a0428", hash: "57cba3ef41226cba423a8e7de50f392c95caa09f24330070bf933a204a837ce5" },
    ] },
    { value: "osadženje", evidence: [
        { id: 11026264, form: "osadženje", document: "agregatno-stanje-c5422234", hash: "7368e9df3176a3a8c9b4c2718c1e5bea105b82f4fc639db43f98f46290bedb20" },
        { id: 11026553, form: "osadženje", document: "agregatno-stanje-c5422234", hash: "35df3cb96d849a847e1b3e0c6cdb91faa7af906112d2edd7556b6953bea245b9" },
    ] },
    { value: "smartfon", evidence: [
        { id: 11641721, form: "smartfon", document: "iswiki-2020", hash: "c2736fe4d43f9228254a4d6714506c6a79e3c63a46afd89df6d9204a3156e184" },
        { id: 12485431, form: "smartfon", document: "messages-discord-301e06a8", hash: "aeea5260d21460cdd3671bebc7bc1a115786d80f1b6cf708c61f41bc6bc2cc0a" },
    ] },
] as const

const reviewed = [
    ...nouns.map((noun) => ({ ...noun, pos: "NOUN", sourceCluster: noun.value })),
    { value: "elf", pos: "NOUN", sourceCluster: "elfov", evidence: [
        { id: 11831932, form: "elfov", document: "iswiki-697", hash: "3d0d294271c3e08b95f05dce07e6f72b4fce30c5a9549c2f65d63801a60fc83f" },
        { id: 12273508, form: "elfov", document: "messages-discord-050a4955", hash: "2de407112c22cc49c7a5d9ea851a4e83fdcaea773f9a36d6ca609fb0040f1873" },
    ] },
    { value: "gulaš", pos: "NOUN", sourceCluster: "gulašom", evidence: [
        { id: 13912568, form: "gulašom", document: "messages-old-discord-5e778873", hash: "bbc7f2d5554037264a21fd89cb453540abaa72213ccdeba460f45b66b0364919" },
        { id: 14006918, form: "gulašom", document: "messages-old-discord-8b14bc1a", hash: "43a43053ebf45e8b3f1f5e3bf2f7383b610bf51a86ea5b8ea9d4972debd95e4d" },
    ] },
    { value: "antonim", pos: "NOUN", sourceCluster: "antonimom", evidence: [
        { id: 11258295, form: "antonimom", document: "iswiki-1105", hash: "e26307b86ee9ef55d1a08ebf6569ae8a36951e4655fa16e9e679ebaac70f6a42" },
        { id: 11885265, form: "antonimom", document: "iswiki-879", hash: "8fa47d3232710c8158e8336f9aa67b66c13e0838953a14e4f4634081a89bbbe4" },
    ] },
    { value: "erozija", pos: "NOUN", sourceCluster: "erozija", evidence: [
        { id: 11646219, form: "erozija", document: "iswiki-2036", hash: "e078e86f3fe1f7e431accc2e4113efca53d9411dab68d78bca2fb350fbc7c38c" },
        { id: 11172678, form: "erozije", document: "damba-71281a27", hash: "f95e8ee99ef4cbdad4330c1c70bcaf6f0499c8200d1f25ad0e3e34d23396d6b8" },
    ] },
    { value: "brutalizm", pos: "NOUN", sourceCluster: "brutalizm", evidence: [
        { id: 12836826, form: "brutalizm", document: "messages-discord-7eafe231", hash: "d52c59fdd4ae7232357f9a22a403e6f33e1b7d0b2f5bbe75bdb3b19d8cb98ac5" },
        { id: 13101324, form: "brutalizm", document: "messages-discord-abad8e5e", hash: "e18baa6d5ff18fac92050c7cfe258e09dbedeb49e4c2bd3975d13ba3a5cc6b0c" },
    ] },
    { value: "epičny", pos: "ADJ", sourceCluster: "epičny", evidence: [
        { id: 11577269, form: "epičny", document: "iswiki-1795", hash: "5437f3c835ee21a71e4b37d87104642a85f7c13557f56474ed5e9b3f97ac14c6" },
        { id: 15025429, form: "epičny", document: "messages-tvorba-369a268c", hash: "15d55185b081ba061c226b813865825ddeaa98436d679d60515d8d6f2ce6cb7d" },
    ] },
    { value: "ejektivny", pos: "ADJ", sourceCluster: "ejektivny", evidence: [
        { id: 11170583, form: "ejektivny", document: "cil-kirilica-d7cb0d21", hash: "e67204724d4753f1836de63317d3bdc40ade011e9eff042e9d52cecff7c33cfd" },
        { id: 11651224, form: "ejektivnu", document: "iswiki-2050", hash: "d2be62bb365447a27df9c051008ca222a98d098c29b59ad5f55948f070a9ee8a" },
    ] },
    { value: "fungovati", pos: "VERB", sourceCluster: "funguje", evidence: [
        { id: 11092743, form: "fungovati", document: "b-medžuslovjanský-sleng-i-procesy-jego-pojavjenja-b-90327bda", hash: "c3a8902988aa790f1514d1ea256f4fe4ba9a581704202db526b211091c653cf5" },
        { id: 12213772, form: "funguje", document: "messages-discord-02a4b25f", hash: "5c5166b2d18a28c9c53cd623a6afc886dffe4ca4781587265fbbc44bab85ac02" },
    ] },
] as const

interface Spelling {
    id: number
    value: string | null
    pos: string
}

interface CorpusOccurrence {
    surfaceForm: string
    documentSlug: string
    rawText: string
}

const apply = process.argv.includes("--apply")
const dictionary = new Database(process.env.SQLITE_DB ?? resolve("interlex.db"), {
    readonly: !apply,
    fileMustExist: true,
    timeout: 10_000,
})
const corpus = new Database(process.env.CORPUS_SQLITE_DB ?? resolve("corpus.db"), {
    readonly: true,
    fileMustExist: true,
    timeout: 10_000,
})

const spellingKey = (word: string) => foldDiacritics(normalizeSurfaceForm(word))
const entryKey = (pos: string, word: string) => `${pos}:${spellingKey(word)}`
const token = corpus.prepare<[number], CorpusOccurrence>(`
    SELECT t.surfaceForm, t.documentSlug, s.rawText
    FROM CorpusToken t JOIN CorpusSentence s ON s.id = t.sentenceId
    WHERE t.id = ? AND t.wordIndex <> -1
`)
const lexemeSpellings = dictionary.prepare<[], Spelling>(`
    SELECT id, value, upper(pos) AS pos FROM lexemes WHERE upper(pos) IN ('NOUN', 'ADJ', 'VERB')
    UNION
    SELECT l.id, a.value, upper(l.pos) FROM lexeme_allophones a JOIN lexemes l ON l.id = a.lexemeId
    WHERE upper(l.pos) IN ('NOUN', 'ADJ', 'VERB')
`)
const draftSpellings = dictionary.prepare<[], Spelling>(`
    SELECT id, value, upper(pos) AS pos FROM candidates WHERE upper(pos) IN ('NOUN', 'ADJ', 'VERB') AND promotedAt IS NULL
    UNION
    SELECT id, isv, upper(pos) FROM candidates WHERE upper(pos) IN ('NOUN', 'ADJ', 'VERB') AND promotedAt IS NULL
`)

function indexSpellings(rows: Iterable<Spelling>) {
    const index = new Map<string, Set<number>>()
    for (const row of rows) {
        for (const variant of expandVariants(row.value)) {
            const key = entryKey(row.pos, variant)
            const ids = index.get(key) ?? new Set<number>()
            ids.add(row.id)
            index.set(key, ids)
        }
    }
    return index
}

function verifyEvidence() {
    for (const entry of reviewed) {
        for (const example of entry.evidence) {
            const found = token.get(example.id)
            if (!found || found.documentSlug !== example.document ||
                normalizeSurfaceForm(found.surfaceForm) !== example.form ||
                createHash("sha256").update(found.rawText).digest("hex") !== example.hash) {
                throw new Error(`Изменился корпусный контекст для ${entry.value} (токен ${example.id})`)
            }
        }
    }
}

function stageDrafts(write: boolean) {
    const lexemes = indexSpellings(lexemeSpellings.iterate())
    const drafts = indexSpellings(draftSpellings.iterate())
    const insert = dictionary.prepare(`
        INSERT INTO candidates (value, pos, updatedAt) VALUES (?, ?, ?)
    `)
    const audit = dictionary.prepare(`
        INSERT INTO audit_logs (actionId, entityType, entityId, field, newValue, userEmail, createdAt)
        VALUES (?, 'Candidate', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    const now = new Date().toISOString()

    for (const entry of reviewed) {
        const key = entryKey(entry.pos, entry.value)
        const existingLexemes = lexemes.get(key)
        if (existingLexemes?.size) {
            console.log(`${entry.value}: уже есть словарная статья ${[...existingLexemes].join(", ")}`)
            continue
        }
        const existingDrafts = drafts.get(key)
        if (existingDrafts?.size) {
            console.log(`${entry.value}: уже есть кандидат ${[...existingDrafts].join(", ")}`)
            continue
        }
        if (!write) {
            console.log(`${entry.value}: создать кандидата ${entry.pos}`)
            continue
        }
        const id = Number(insert.run(entry.value, entry.pos, now).lastInsertRowid)
        const actionId = randomUUID()
        audit.run(actionId, id, "value", entry.value, actor)
        audit.run(actionId, id, "pos", entry.pos, actor)
        audit.run(actionId, id, "createdFromCorpusCluster", entry.sourceCluster, actor)
        audit.run(actionId, id, "corpusEvidence", JSON.stringify(entry.evidence), actor)
        console.log(`${entry.value}: создан кандидат №${id}`)
    }
}

try {
    corpus.transaction(verifyEvidence)()
    if (apply) dictionary.transaction(() => stageDrafts(true)).immediate()
    else dictionary.transaction(() => stageDrafts(false))()
} finally {
    corpus.close()
    dictionary.close()
}
