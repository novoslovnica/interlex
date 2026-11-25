import { createHash } from "node:crypto"
import { resolve } from "node:path"
import Database from "better-sqlite3"
import { normalizeSurfaceForm } from "@/lib/corpus/surfaceForm"

// For each form the signature covers the full set of reviewed occurrences.
const nounForms = [
    { key: "koeficient", noun: "koeficient", occurrences: 47, signature: "5f38b3478ea90f87436bc8b81b41234b3c39688795a20cede859708c4e39677d" },
    { key: "koeficienta", noun: "koeficient", occurrences: 2, signature: "fb5cf658d632490f95db1eec361e06d78c0bb3a17ef3df83e0594989d0ad4acc" },
    { key: "koeficienty", noun: "koeficient", occurrences: 119, signature: "1d65d861b5e100829ca53bbbbcf8b2c6bdb73e2bf21ceaa65b969f84fb73d8f9" },
    { key: "koeficientov", noun: "koeficient", occurrences: 130, signature: "7fabbde8acf8be109c7d0cdea29c7e9bc462adb1e783a40089c5c06e907ce9a4" },
    { key: "koeficientami", noun: "koeficient", occurrences: 168, signature: "a82723ebf83e2bc5422b595c04a4a13a3cdb62e462f68e5ec6cb881e51dafcef" },
    { key: "koeficientom", noun: "koeficient", occurrences: 3, signature: "98b6a4c4df9dc248ed2ab33c2f096f5fad6687a060823c3659050da18a6413f7" },
    { key: "koeficientah", noun: "koeficient", occurrences: 16, signature: "4f20d2ebfc14c5b57ea00188954c5c2d1fc124a77f2006435a3b4f61ad0300a3" },
    { key: "relacija", noun: "relacija", occurrences: 64, signature: "d08f8e4202b51a2347524485533dc090cfbada3b1108b63d85e4f8f1682864d6" },
    { key: "relacije", noun: "relacija", occurrences: 133, signature: "ae552caf5231438b092a9a757d4041a506f01652bd2a67912b9443532b1500db" },
    { key: "relaciju", noun: "relacija", occurrences: 22, signature: "898e8ba0c50a4de7354d11a10f470fb1bbac3629e8030e3688d4753d01a1e641" },
    { key: "relacij", noun: "relacija", occurrences: 43, signature: "94cf373f67c980ce71795be87e997dc196412031f482fad12c5cd5588f5726a1" },
    { key: "relacijah", noun: "relacija", occurrences: 4, signature: "392bcc21466ace900b0ac6d0000359518fb8001d3aef2d97731a7cb56e9d8c1f" },
    { key: "relacijam", noun: "relacija", occurrences: 7, signature: "232b5b0e62bdedb3869595aceeb087596319040ccd50aaca1116cc7335096840" },
    { key: "relacijami", noun: "relacija", occurrences: 11, signature: "e6890e02faf5ddfa060f48c96b2bd46a887475324ec7f0e60f893675c49856b9" },
    { key: "relacijeju", noun: "relacija", occurrences: 4, signature: "587c321158cd06e1a87a41e3d3d5416b0c025dfe8fe9d912faaaa733937d9dcd" },
    { key: "koncept", noun: "koncept", occurrences: 62, signature: "564a3e3e4fb29ccf23f9a327180975a7ca7df9d8c3dc12eb522a6638147f28c7" },
    { key: "koncepta", noun: "koncept", occurrences: 18, signature: "5edf45d92593270a08a4fb4f7ff790de04de12ca4c39e07de92575ffec868ec0" },
    { key: "konceptom", noun: "koncept", occurrences: 3, signature: "0b56d499b5306cba354d3510247320f61fcd74661034186c1eaf4bdf900891fc" },
    { key: "konceptov", noun: "koncept", occurrences: 8, signature: "698b44d5068e2dc8dab6f9e63f37a5c77978679e261a98f04cd293ef8838ea75" },
    { key: "koncepty", noun: "koncept", occurrences: 20, signature: "2b43c92bbc6f7ff98241d1c771eec64e0b4097fdee227c32761dc99e07974c45" },
    { key: "konceptu", noun: "koncept", occurrences: 7, signature: "87de8de7f6f88c3ce32e8637287ddf95d8133b4e3808380398312968fbac9cbb" },
    { key: "konceptami", noun: "koncept", occurrences: 1, signature: "b9c38fac8982a3ca66764ea02464d14893677984cf0d323a1b02316f984b004a" },
    { key: "prefekt", noun: "prefekt", occurrences: 6, signature: "350d4efd3c622b53285d847f1d1c24fc9f0ab628ddba7858ebbb4ea95c6bc82c" },
    { key: "prefekte", noun: "prefekt", occurrences: 2, signature: "4db1048496a33d9577d55cb80188ad7fe577e374262565f8cb36eb409b17b495" },
    { key: "prefektom", noun: "prefekt", occurrences: 2, signature: "0d39ebda1f456744f6f2cb3399de17f6f541fa4488b660c649cc5fe4357e8f75" },
    { key: "ikanje", noun: "ikanje", occurrences: 3, signature: "398ac2ed22c248ab5b9688e7c7044dc55a98b007da0ea61269b6e368dbd24b73" },
    { key: "ikanja", noun: "ikanje", occurrences: 1, signature: "b9228eb92c94f83b792cd33a8508fa64df1dc4f211ba714ca67c3fb21494c7cf" },
    { key: "sadženje", noun: "sadženje", occurrences: 6, signature: "a5b57eaa0528ff1f619fcc544022b15baee47117a27910926a61be1389fe6a5a" },
    { key: "osadženje", noun: "osadženje", occurrences: 4, signature: "6e4c4704ad5f7187bf324d18efe6f92287ff53395a6e72c4f059c326d4266ae5" },
    { key: "smartfon", noun: "smartfon", occurrences: 22, signature: "d7fb746617683b6976f098fa35ffa9626728d98bb008c60192941fd0c7996029" },
] as const

const reviewedForms = [
    ...nounForms.map(({ noun, ...form }) => ({
        ...form, lemma: noun, pos: "NOUN", promote: form.key === noun,
    })),
    { key: "elfov", lemma: "elf", pos: "NOUN", promote: false, occurrences: 39, signature: "7a32939160f04f727773a79f039770f5c565602b900d0637173bda65a5e45d02" },
    { key: "gulašom", lemma: "gulaš", pos: "NOUN", promote: true, occurrences: 2, signature: "5d74108c7522d3ed20e201edf29fd1e4ea413050750cadd62904bd226cd0adb4" },
    { key: "gulaša", lemma: "gulaš", pos: "NOUN", promote: false, occurrences: 1, signature: "a44f22e845f208971d2f442344b389c44853523218e77a0e0ec88ab15585812f" },
    { key: "antonimom", lemma: "antonim", pos: "NOUN", promote: true, occurrences: 3, signature: "a150d2b80b068fa9b937a43d169e7e826839884957113e50054a3c8e0cb2dbbe" },
    { key: "antonimami", lemma: "antonim", pos: "NOUN", promote: false, occurrences: 1, signature: "8fb0d269cbdc8e5c890efbfbda75fd33f843f551998e05839c743dbee0ff8243" },
    { key: "antonimy", lemma: "antonim", pos: "NOUN", promote: false, occurrences: 1, signature: "60781bf011499e7b04fe83e38c8aa7e0aade001a9fb99c0668e1d3a85ff58562" },
    { key: "erozija", lemma: "erozija", pos: "NOUN", promote: true, occurrences: 3, signature: "ecbad6cd3cf867903dbd53bce3c1c210075cc3e77c61843be5149aea0ed51aee" },
    { key: "erozije", lemma: "erozija", pos: "NOUN", promote: false, occurrences: 7, signature: "2e0d59bb6ac0d12ad9bee19e6c2a3dff50040c126df78deba03007c98649bd1d" },
    { key: "brutalizm", lemma: "brutalizm", pos: "NOUN", promote: true, occurrences: 3, signature: "a260115f2f44118c66efb0503186b41f33a56a96ce77f720b1bd25c5fd919eea" },
    { key: "epičny", lemma: "epičny", pos: "ADJ", promote: true, occurrences: 3, signature: "6ca3b2284df1b9c808f380e02acd40675a37fa65b7e17e7d7417071903c15404" },
    { key: "epične", lemma: "epičny", pos: "ADJ", promote: false, occurrences: 3, signature: "cf06c513d89320abd21efdc1fa6e60ac3274c13e5f4d19dd30c9d8f6335dea98" },
    { key: "ejektivny", lemma: "ejektivny", pos: "ADJ", promote: true, occurrences: 27, signature: "67f0506be42a7409ebe97f6df6fb754d451b80a5315db9d50c05c835d9e6c78d" },
    { key: "ejektivnu", lemma: "ejektivny", pos: "ADJ", promote: false, occurrences: 14, signature: "f044822f832a84fcb5232d3ae8911dd4679e984ca36d65b55c59ec2ccc489185" },
    { key: "ejektivnyh", lemma: "ejektivny", pos: "ADJ", promote: false, occurrences: 6, signature: "e567fb573fa359ac7c66a39dffd8c00bbf3c20347eeeb02ac0348a845093dad6" },
    { key: "ejektivne", lemma: "ejektivny", pos: "ADJ", promote: false, occurrences: 4, signature: "9303053e94c64dfc32569d02ca53d55695cd241af100c479a3fa4192c868ef30" },
    { key: "ejektivnoj", lemma: "ejektivny", pos: "ADJ", promote: false, occurrences: 3, signature: "088389248990d5983692e3ae50f04d4967e618eb43090cd5e20c2698efc5460f" },
    { key: "ejektivnogo", lemma: "ejektivny", pos: "ADJ", promote: false, occurrences: 3, signature: "0e98c5f77837c0273336e4a76a790f8ab5c8b1fd722d7e0d807cb0b2d50caeff" },
    { key: "funguje", lemma: "fungovati", pos: "VERB", promote: true, occurrences: 237, signature: "d497daa10c32bd220fb047ba697bee8dadc3de837004eaa05f9905003ea6ab64" },
    { key: "fungovati", lemma: "fungovati", pos: "VERB", promote: false, occurrences: 75, signature: "4ff8d9b24324bf2a24a5cac74e975f3f6bc2200d6d81ae8df731c85a93598f5a" },
    { key: "fungujut", lemma: "fungovati", pos: "VERB", promote: false, occurrences: 35, signature: "9a803172e5fc9ad2b394cdd242a364febca66bda72b1e9aa4013b728c9f2c793" },
    { key: "fungoval", lemma: "fungovati", pos: "VERB", promote: false, occurrences: 11, signature: "61e9b5e5fc42674004f2357533e0aa8ef0324667b9f35d8765c6c9d3cd998202" },
    { key: "fungovala", lemma: "fungovati", pos: "VERB", promote: false, occurrences: 7, signature: "5a199826e097589505f83578c18c0eed20241859d7f5268e59188ac11b72331d" },
    { key: "fungovalo", lemma: "fungovati", pos: "VERB", promote: false, occurrences: 7, signature: "02c1bb7318a49e68d062fc3389ee419a7bca481070e1a648ccfdd3a9e47d02ce" },
    { key: "funguješ", lemma: "fungovati", pos: "VERB", promote: false, occurrences: 1, signature: "0a8b1cfb58700c1fa55789dc6e91b47638752e2ea827692e8cb1eddf09374fa1" },
    { key: "funguju", lemma: "fungovati", pos: "VERB", promote: false, occurrences: 1, signature: "66b0de11cb573514d9554d775426e48718cf9e001b9f4c565c2bfc1efff69ed2" },
] as const

interface Token {
    surfaceForm: string
    sentenceId: string
    documentSlug: string
    wordSlug: string | null
    matchCount: number
    isPartialMatch: number
    resolutionSource: string | null
}

interface Hypothesis {
    id: number
    status: string
    ruleSource: string
    guessedPos: string
    reconstructedForm: string
    candidateId: number | null
    resolutionNote: string | null
    reviewedByEmail: string | null
    reviewedAt: string | null
}

const actor = "script:link-reviewed-corpus-forms"
const apply = process.argv.includes("--apply")
const dictionary = new Database(process.env.SQLITE_DB ?? resolve("interlex.db"), {
    readonly: true, fileMustExist: true, timeout: 10_000,
})
const corpus = new Database(process.env.CORPUS_SQLITE_DB ?? resolve("corpus.db"), {
    readonly: !apply, fileMustExist: true, timeout: 10_000,
})
const pendingDrafts = dictionary.prepare<[string, string], { id: number }>(`
    SELECT id FROM candidates WHERE value = ? AND pos = ? AND promotedAt IS NULL
`)
const scan = corpus.prepare<[], Token>(`
    SELECT surfaceForm, sentenceId, documentSlug, wordSlug, matchCount, isPartialMatch, resolutionSource
    FROM CorpusToken WHERE wordIndex <> -1
`)
const sentenceText = corpus.prepare<[string], { rawText: string }>(
    "SELECT rawText FROM CorpusSentence WHERE id = ?",
)
const readGroup = corpus.prepare<[string], Hypothesis>(`
    SELECT id, status, ruleSource, guessedPos, reconstructedForm, candidateId,
        resolutionNote, reviewedByEmail, reviewedAt
    FROM CorpusCandidateProposal WHERE clusterKey = ? ORDER BY rank, id
`)
const update = corpus.prepare(`
    UPDATE CorpusCandidateProposal
    SET status = ?, candidateId = ?, resolutionNote = ?, reviewedByEmail = ?, reviewedAt = ?
    WHERE id = ? AND status IN ('pending', 'deferred') AND candidateId IS NULL
        AND reviewedAt IS NULL AND reviewedByEmail IS NULL
`)
const hash = (text: string) => createHash("sha256").update(text).digest("hex")
const draftKey = ({ lemma, pos }: { lemma: string; pos: string }) => `${pos}:${lemma}`

function review() {
    const draftIds = new Map<string, number>()
    for (const form of reviewedForms) {
        const key = draftKey(form)
        if (draftIds.has(key)) continue
        const matches = pendingDrafts.all(form.lemma, form.pos)
        if (matches.length !== 1) {
            throw new Error(`Для ${form.lemma} (${form.pos}) нужен ровно один действующий черновик. Найдено ${matches.length}.`)
        }
        draftIds.set(key, matches[0].id)
    }
    const observed = new Map<string, string[]>(reviewedForms.map(({ key }) => [key, []]))
    const conflicts = new Set<string>()
    for (const token of scan.iterate()) {
        const key = normalizeSurfaceForm(token.surfaceForm)
        const forms = observed.get(key)
        if (!forms) continue
        const text = sentenceText.get(token.sentenceId)?.rawText
        if (!text || token.resolutionSource === "manual" || token.matchCount > 0 || token.wordSlug !== null) {
            conflicts.add(key)
            continue
        }
        forms.push(JSON.stringify([token.surfaceForm, token.documentSlug, hash(text)]))
    }

    const now = new Date().toISOString()
    let clusters = 0
    let hypotheses = 0
    for (const form of reviewedForms) {
        const draftId = draftIds.get(draftKey(form))
        if (draftId === undefined) throw new Error(`Черновик ${form.lemma} не найден`)
        const rows = readGroup.all(form.key)
        if (rows.length > 0 && rows.every((row) => row.candidateId === draftId && row.reviewedByEmail === actor)) {
            console.log(`${form.key} уже связан с кандидатом №${draftId}`)
            continue
        }
        const uses = observed.get(form.key) ?? []
        if (conflicts.has(form.key) || uses.length !== form.occurrences ||
            hash(JSON.stringify(uses.sort())) !== form.signature) {
            console.log(`Пропущен ${form.key}. Корпусный контекст изменился.`)
            continue
        }
        if (rows.length === 0 || rows.some((row) =>
            !["pending", "deferred"].includes(row.status) || row.ruleSource === "editor_workbench" ||
            row.candidateId !== null || row.reviewedAt !== null || row.reviewedByEmail !== null ||
            (row.resolutionNote !== null && row.resolutionNote !== "автоматически: иностранный контекст")
        )) {
            console.log(`Пропущен ${form.key}. Состояние очереди изменилось.`)
            continue
        }
        const head = form.promote
            ? rows.find((row) => row.guessedPos === form.pos && row.reconstructedForm === form.lemma)
            : undefined
        if (form.promote && !head) {
            console.log(`Пропущен ${form.key}. Словарная гипотеза исчезла.`)
            continue
        }
        if (apply) {
            // DB runner records this output before the update so the old state can be restored per row.
            console.log(JSON.stringify({ key: form.key, draftId, before: rows }))
            const note = `Подтверждено ${uses.length} корпусных вхождений. Кандидат №${draftId} «${form.lemma}».`
            for (const row of rows) {
                const status = row.id === head?.id ? "promoted" : "merged_into_existing"
                if (update.run(status, draftId, note, actor, now, row.id).changes !== 1) {
                    throw new Error(`Изменилась гипотеза №${row.id}`)
                }
            }
        }
        clusters++
        hypotheses += rows.length
        console.log(`${form.key} → кандидат №${draftId} «${form.lemma}», ${rows.length} гипотез`)
    }
    console.log(JSON.stringify({ apply, clusters, hypotheses }))
}

try {
    // Scan under a read snapshot and keep the write phase short.
    corpus.transaction(review)()
} finally {
    corpus.close()
    dictionary.close()
}
