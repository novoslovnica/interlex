import { createHash, randomUUID } from "node:crypto"
import Database from "better-sqlite3"

// Existing links reviewed against the meaning and the indicated producing form.
const priDerivatives = [
    [2639, "pribegnuti", "priběgnu", "begnuti / приближение бегом"],
    [2647, "priiedzati", "prijědža", "jehati / прибытие транспортом"],
    [2649, "priietiie", "prijęti", "jeti, imati / приём, принятие"],
    [2657, "prikazny", "prikazn", "kazati / приказ, приказывать"],
    [2679, "privodzati", "privodža", "voditi, voziti / приводить, привозить"],
    [2681, "privoz", "privoz", "voditi, voziti / приводить, привозить"],
    [16310, "pribiti", "pribi", "biti / прикрепление ударами"],
    [16311, "pribivati", "pribiva", "biti / прикрепление ударами"],
    [16313, "priblizati se", "približa", "bliziti se / приближение"],
    [16314, "priblizeny", "približen", "bliziti se / приближение"],
    [16315, "pribliziti se", "približi", "bliziti se / приближение"],
    [16318, "pribyti", "priby", "byti / прибытие"],
    [16319, "pribyvati", "pribyva", "byti / прибытие"],
    [16320, "priceliti", "pricěli", "celiti / направить к цели"],
    [16327, "pricisliti", "pričisliti k", "cisliti / причисление"],
    [16328, "pricisljati", "pričisljati k", "cisliti / причисление"],
    [16329, "pridati", "prida", "dati, davati / добавление"],
    [16330, "pridatok", "pridatȯk", "dati, davati / добавление"],
    [16331, "pridavati", "pridava", "dati, davati / добавление"],
    [16333, "pridelanje", "pridělań", "delati, deliti / назначить, отнести к категории"],
    [16334, "pridelati", "priděla", "delati, deliti / назначить, отнести к категории"],
    [16335, "prideliti", "priděli", "delati, deliti / назначить, отнести к категории"],
    [16336, "prideljati", "pridělja", "delati, deliti / назначить, отнести к категории"],
    [16339, "pridrzivati se", "pridŕživa", "drzati / держаться за что-либо"],
    [16340, "pridumati", "priduma", "dumati / придумать"],
    [16342, "prigledati se", "priględa", "gledati, gledeti / направить внимание"],
    [16343, "prigledati", "priględa", "gledati, gledeti / направить внимание"],
    [16344, "prigledeti se", "priględě", "gledati, gledeti / направить внимание"],
    [16345, "prigledeti", "priględě", "gledati, gledeti / направить внимание"],
    [16346, "prignuti", "prignų", "gnuti, gybati / пригнуть, пригибать"],
    [16351, "prigotovjenje", "prigotovjeń", "gotoviti / приготовление"],
    [16352, "prigrad", "prigråd", "grad, granica / примыкание к городу, границе"],
    [16353, "prigranicny", "prigraničn", "grad, granica / примыкание к городу, границе"],
    [16354, "prigybati", "prigyba", "gnuti, gybati / пригнуть, пригибать"],
    [16355, "prihod", "prihod", "hoditi / приход"],
    [16370, "prijaviti se", "prijavi", "javiti se, javjati se / регистрация присутствия"],
    [16371, "prijavjati se", "prijavja", "javiti se, javjati se / регистрация присутствия"],
    [16374, "prijem", "prijėm", "jeti, imati / приём, принятие"],
    [16376, "prijemnik", "prijėmnik", "jeti, imati / приём, принятие"],
    [16380, "prijeti", "priję", "jeti, imati / приём, принятие"],
    [16381, "prijetje", "prijęť", "jeti, imati / приём, принятие"],
    [16382, "prijezdati", "priježđa", "jehati / прибытие транспортом"],
    [16385, "prijmati", "prijma", "jeti, imati / приём, принятие"],
    [16386, "prikaz", "prikaz", "kazati / приказ, приказывать"],
    [16387, "prikazati", "prikaza", "kazati / приказ, приказывать"],
    [16388, "prikazyvati", "prikazyva", "kazati / приказ, приказывать"],
    [16390, "prikladati", "priklada", "kladati / прикладывать, прилагать"],
    [16391, "prikop", "prikop", "kopati / придорожная канава"],
    [16393, "prilegly", "prilegl", "legti / прилегание"],
    [16394, "prilepiti se", "prilěpi", "lepiti / приклеивание"],
    [16395, "prilepiti", "prilěpi", "lepiti / приклеивание"],
    [16396, "priletati", "prilěta", "letati / прибытие полётом"],
    [16399, "priliv", "priliv", "liti / прилив"],
    [16400, "priloga", "prilog", "loziti / приложить, вложить"],
    [16401, "prilozenje", "priložeń", "loziti / приложить, вложить"],
    [16402, "priloziti", "priloži", "loziti / приложить, вложить"],
    [16431, "prinos", "prinos", "nositi / то, что приносят"],
    [16514, "prisvojny", "prisvojn", "svoj / присвоение и принадлежность"],
    [16586, "priznavati", "priznava", "zna- / признание"],
] as const

const removeOnly = [
    [2671, "pristina", "prištin", 1718, "Топоним Приштина"],
    [16407, "prima", "prim", 1718, "Заимствованное название музыкального интервала"],
    [16309, "pri", "pri", 1718, "Самостоятельный предлог"],
    [5325, "bez", "bez", 70, "Самостоятельный предлог"],
] as const

// Resolve the known root boundaries before adding the reviewed members.
const rootCorrections = [
    { id: 263, previous: "rozum", value: "um", members: [536, 2909, 2910, 20330, 20356] },
    { id: 461, previous: "inak", value: "in", members: [975, 977, 8520, 8672] },
] as const

const umDerivatives = [
    [132, "bezumec", "bezumec", ["bez", "ec"], 82],
    [133, "bezumny", "bezumny", ["bez", "n"], 82],
    [134, "bezumstvo", "bezumstv", ["bez", "stv"], 82],
    [5425, "bezumje", "bezum", ["bez"], null],
    [5426, "bezumnik", "bezumnik", ["bez", "n", "nik"], null],
    [5427, "bezumny", "bezumn", ["bez", "n"], null],
    [536, "dorozumiti", "dorozumi", ["do"], null],
    [2910, "rozumny", "rozumn", ["n"], null],
    [20356, "umny", "umn", ["n"], null],
] as const

const databasePath = process.env.SQLITE_DB
if (!databasePath) throw new Error("SQLITE_DB is required. Use npm run db:run.")
const apply = process.argv.includes("--apply")
const db = new Database(databasePath, { readonly: !apply, fileMustExist: true })
db.pragma("foreign_keys = ON")
db.pragma("busy_timeout = 10000")

function run() {
    const reviewedIds = [...new Set([
        ...[...priDerivatives, ...removeOnly, ...umDerivatives].map(([id]) => id),
        ...rootCorrections.flatMap(({ members }) => members),
    ])].sort((a, b) => a - b)
    const readEvidence = db.prepare<[number]>(`
        SELECT id, value, stem, pos, (SELECT json_group_array(value) FROM (
            SELECT DISTINCT t.value FROM meanings s JOIN translations t ON t.meaningId = s.id
            WHERE s.lexemeId = lexemes.id AND t.language = 'ru' ORDER BY t.value
        )) AS ru FROM lexemes WHERE id = ?
    `)
    const digest = createHash("sha256").update(JSON.stringify(reviewedIds.map((id) => readEvidence.get(id)))).digest("hex")
    if (digest !== "05deefc5e4279af0a678e158331ecff6cded409e5003aa6b2100144ad547550f") {
        throw new Error("Reviewed dictionary forms or meanings changed. Repeat editorial verification.")
    }
    const time = new Date().toISOString()
    const audit = db.prepare(`
        INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userEmail)
        VALUES (?, ?, ?, ?, ?, ?, 'script:review-morpheme-affixes-03')
    `)
    const root = db.prepare<[number], {
        value: string; meaning: string | null; stressPosition: number | null; protoSlavicWordId: number | null
    }>("SELECT value, meaning, stressPosition, protoSlavicWordId FROM morphemes WHERE id = ? AND type = 0")
    const find = db.prepare<[number, string], { id: number }>("SELECT id FROM morphemes WHERE type = ? AND value = ?")
    const allophones = db.prepare<[number], { id: number; code: string; value: string }>(`
        SELECT a.id, f.code, a.value FROM morpheme_allophones a
        JOIN allophone_flavors f ON f.id = a.flavorId WHERE a.morphemeId = ?
    `)
    const members = db.prepare<[number], { lexemeId: number }>(`
        SELECT DISTINCT lexemeId FROM lexemes_morphemes WHERE morphemeId = ? ORDER BY lexemeId
    `)
    for (const [id, value] of [[70, "bez"], [82, "bezum"], [1718, "pri"]] as const) {
        if (root.get(id)?.value !== value) throw new Error(`Root #${id} ${value} changed after review`)
    }
    let correctedRoots = 0
    for (const { id, previous, value, members: expected } of rootCorrections) {
        const current = root.get(id)
        const variants = allophones.all(id)
        const [core] = variants
        if (current?.value === value && core?.code === "CORE" && core.value === value) continue
        if (current?.value !== previous || current.meaning !== null || current.stressPosition !== null ||
            current.protoSlavicWordId !== null || variants.length !== 1 || core.code !== "CORE" || core.value !== previous ||
            JSON.stringify(members.all(id).map(({ lexemeId }) => lexemeId)) !== JSON.stringify(expected) ||
            find.all(0, value).length > 0) {
            throw new Error(`Root family #${id} ${previous} changed after review`)
        }
        correctedRoots++
        console.log(`#${id} ${previous} → ${value} (корень и CORE)`)
        if (apply) {
            db.prepare("UPDATE morphemes SET value = ?, updatedAt = ? WHERE id = ?").run(value, time, id)
            db.prepare("UPDATE morpheme_allophones SET value = ? WHERE id = ?").run(value, core.id)
            const action = randomUUID()
            audit.run(action, "Morpheme", id, "value", previous, value)
            audit.run(action, "Morpheme", id, "CORE", previous, value)
        }
    }

    const affixIds = new Map<string, number>()
    for (const [type, names] of [[1, ["pri", "bez", "do"]], [2, ["ec", "n", "nik", "stv"]]] as const) {
        for (const name of names) {
            const matches = find.all(type, name)
            if (matches.length !== 1) throw new Error(`Expected one affix ${name}`)
            affixIds.set(name, matches[0].id)
        }
    }
    function affixId(name: string) {
        const id = affixIds.get(name)
        if (id === undefined) throw new Error(`Missing affix ${name}`)
        return id
    }

    const word = db.prepare<[number, string, string]>("SELECT id FROM lexemes WHERE id = ? AND value = ? AND stem = ?")
    const links = db.prepare<[number], { morphemeId: number }>(`
        SELECT DISTINCT morphemeId FROM lexemes_morphemes
        WHERE lexemeId = ? AND morphemeId IS NOT NULL ORDER BY morphemeId
    `)
    const remove = db.prepare("DELETE FROM lexemes_morphemes WHERE lexemeId = ? AND morphemeId = ?")
    const add = db.prepare("INSERT INTO lexemes_morphemes (lexemeId, morphemeId) VALUES (?, ?)")
    const touch = db.prepare("UPDATE lexemes SET updatedAt = ? WHERE id = ?")
    let additions = 0
    let removals = 0

    function revise(id: number, value: string, stem: string, oldRootId: number | null, promote: number[], evidence: string) {
        if (!word.get(id, value, stem)) throw new Error(`Lexeme #${id} ${value} changed after review`)
        const before = links.all(id).map(({ morphemeId }) => morphemeId)
        const after = new Set(before)
        const removed = oldRootId !== null && after.delete(oldRootId)
        const added = promote.filter((morphemeId) => !after.has(morphemeId))
        if (!removed && !added.length) return
        if (oldRootId !== null && !removed && added.length) {
            throw new Error(`Legacy root link #${id} / #${oldRootId} changed after review`)
        }
        for (const morphemeId of added) after.add(morphemeId)
        additions += added.length
        removals += Number(removed)
        console.log(`#${id} ${value}: +[${added.join(", ")}] −[${removed ? oldRootId : ""}] · ${evidence}`)
        if (!apply) return
        if (removed) remove.run(id, oldRootId)
        for (const morphemeId of added) add.run(id, morphemeId)
        touch.run(time, id)
        audit.run(randomUUID(), "Lexeme", id, "morphemeIds", JSON.stringify(before), JSON.stringify([...after].sort((a, b) => a - b)))
    }

    for (const [id, value, stem, evidence] of priDerivatives) revise(id, value, stem, 1718, [affixId("pri")], evidence)
    for (const [id, value, stem, rootId, evidence] of removeOnly) revise(id, value, stem, rootId, [], evidence)
    for (const [id, value, stem, affixes, oldRootId] of umDerivatives) {
        revise(id, value, stem, oldRootId, [263, ...affixes.map(affixId)], "um, umny, rozum / ум, разум")
    }
    console.log(JSON.stringify({ apply, correctedRoots, additions, removals }))
}

try {
    const transaction = db.transaction(run)
    if (apply) transaction.immediate()
    else transaction.deferred()
} finally {
    db.close()
}
