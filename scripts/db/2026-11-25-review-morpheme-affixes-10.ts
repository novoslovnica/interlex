import { createHash, randomUUID } from "node:crypto"
import Database from "better-sqlite3"

// Derivative, producing lexeme, and the reviewed shared root.
const transfers = [
    [5413,18618,872],
    [11753,11754,842],
    [7803,7807,363],
    [19009,19028,1318],
    [6222,6219,206],
    [15686,15684,1135],
    [21886,21879,1036],
    [10968,10954,730],
    [10942,10943,727],
    [7053,7049,273],
    [19432,19431,1166],
    [16888,2757,882],
    [5606,5605,102],
    [6691,6693,248],
    [8285,8287,438],
    [10287,10286,617],
    [10754,10757,695],
    [11866,11869,857],
    [13330,13329,969],
    [15895,15893,923],
    [18462,18465,1290],
    [20767,20766,1525],
    [20934,20932,1543],
    [22220,22222,935],
    [22249,22248,1708],
    [6259,20132,1161],
    [11229,2346,876],
    [5817,5819,145],
    [8289,8291,440],
    [19426,11920,872],
    [20205,3584,190],
    [6668,5275,64],
    [6721,7890,378],
    [6726,7890,378],
    [6773,1478,702],
    [6852,6848,876],
    [6939,6937,266],
    [5300,5303,65],
    [5510,5511,90],
    [5558,5561,95],
    [5616,5619,104],
    [5838,5839,148],
    [5922,5926,180],
    [6160,6162,193],
    [6692,6693,248],
    [7052,595,274],
    [7088,7089,281],
    [7806,7807,363],
    [8083,8085,426],
    [8215,8216,433],
    [8286,8287,438],
    [10318,10319,621],
    [10329,10334,622],
    [10756,10757,695],
    [10857,10858,711],
    [11144,11153,753],
    [11496,11501,809],
    [11684,11686,832],
    [11868,11869,857],
    [12627,12636,917],
    [12798,12799,926],
    [12942,12943,914],
    [12990,12991,942],
    [14361,14362,1020],
    [15109,15110,247],
    [15900,15905,923],
    [17975,17976,1252],
    [18433,18434,1288],
    [19023,19028,1318],
    [19550,19551,1224],
    [20355,20356,263],
    [20750,20751,930],
    [20913,20914,1540],
    [22357,22365,933],
] as const

const expectedRoots = [
    [64,"beg"],
    [65,"bel"],
    [90,"blago"],
    [95,"bliz"],
    [102,"bod"],
    [104,"bog"],
    [145,"bud"],
    [148,"buj"],
    [180,"cel"],
    [190,"čin"],
    [193,"cist"],
    [206,"crt"],
    [247,"dob"],
    [248,"dobr"],
    [263,"um"],
    [266,"ver"],
    [273,"drz"],
    [274,"drz"],
    [281,"dur"],
    [363,"glup"],
    [378,"gor"],
    [426,"gust"],
    [433,"hlad"],
    [438,"hrabr"],
    [440,"hran"],
    [617,"kra"],
    [621,"kras"],
    [622,"kratk"],
    [695,"len"],
    [702,"let"],
    [711,"lic"],
    [727,"ljub"],
    [730,"ljud"],
    [753,"mal"],
    [809,"mil"],
    [832,"mokr"],
    [842,"mor"],
    [857,"mudr"],
    [872,"mysl"],
    [876,"pis"],
    [882,"prv"],
    [914,"nez"],
    [917,"nem"],
    [923,"prav"],
    [926,"nerv"],
    [930,"vaz"],
    [933,"ziv"],
    [935,"zna"],
    [942,"niz"],
    [969,"obraz"],
    [1020,"straz"],
    [1036,"pad"],
    [1135,"treb"],
    [1161,"tvor"],
    [1166,"svoj"],
    [1224,"sir"],
    [1252,"sam"],
    [1288,"slad"],
    [1290,"slep"],
    [1318,"star"],
    [1525,"vdov"],
    [1540,"vesel"],
    [1543,"vetr"],
    [1708,"zub"],
    [268, "vcera"], [959, "nyn"], [1035, "zde"], [1307, "zver"],
] as const

const corrections = [
    { id: 93, original: "bledy", value: "bled", core: "blěd", onlyMember: 5543, additions: [5542] },
    { id: 351, original: "gladky", value: "glad", core: "glad", onlyMember: 7738, additions: [7737], otherRoot: 350, meaning: "гладкий, ровный" },
    { id: 402, original: "gruby", value: "grub", core: "grub", onlyMember: 8040, additions: [8037] },
    { id: 735, original: "ljuty", value: "ljut", core: "ljut", onlyMember: 10975, additions: [10973] },
    { id: 881, original: "nagy", value: "nag", core: "nag", onlyMember: 12062, additions: [12050] },
    { id: 927, original: "nesmely", value: "smel", core: "směl", onlyMember: 12808, additions: [12807, 18558, 18559] },
] as const

const newFamilies = [
    { value: "cen", core: "cěn", members: [5928, 5930, 5931, 6983, 6984] },
    { value: "drag", core: "dråg", members: [6983, 6984, 6986] },
    { value: "privat", core: "privat", members: [16540, 16541] },
    { value: "zvuk", core: "zvųk", members: [2257, 5453, 22275, 22277, 22278, 22280] },
] as const

const detached = [
    [2257, 1035], [6982, 268], [6984, 268], [6986, 268], [16541, 959],
    [22277, 1307], [22278, 1035], [22280, 1035],
] as const

const apply = process.argv.includes("--apply")
const databasePath = process.env.SQLITE_DB
if (!databasePath) throw new Error("SQLITE_DB is required. Use npm run db:run.")
const db = new Database(databasePath, { readonly: !apply, fileMustExist: true })
db.pragma("foreign_keys = ON")
db.pragma("busy_timeout = 10000")

function run() {
    const ids = [...new Set([
        ...transfers.flatMap(([target, base]) => [target, base]),
        ...corrections.flatMap(({ onlyMember, additions }) => [onlyMember, ...additions]),
        ...newFamilies.flatMap(({ members }) => [...members]),
        ...detached.map(([id]) => id), 7735, 7736,
    ])].sort((a, b) => a - b)
    const readEvidence = db.prepare<[number]>(`
        SELECT id, slug, value, stem, pos, (SELECT json_group_array(value) FROM (
            SELECT DISTINCT t.value FROM translations t JOIN meanings m ON m.id=t.meaningId
            WHERE m.lexemeId=l.id AND t.language='ru' ORDER BY t.value
        )) AS ru FROM lexemes l WHERE l.id = ?
    `)
    const digest = createHash("sha256").update(JSON.stringify(ids.map((id) => readEvidence.get(id)))).digest("hex")
    if (digest !== "8d4a615ff2618342c9a8b3053bcfc9e92d0ff8a3ab7169d93a78588fbe85a268") {
        throw new Error("Reviewed dictionary forms or meanings changed.")
    }

    const readRoot = db.prepare<[number], { value: string; qualityFlagStatus: string | null; stressPosition: number | null; protoSlavicWordId: number | null; meaning: string | null }>(`
        SELECT value,qualityFlagStatus,stressPosition,protoSlavicWordId,meaning FROM morphemes WHERE id = ? AND type = 0
    `)
    const transferRootIds = new Set<number>(transfers.map(([, , rootId]) => rootId))
    for (const [id, value] of expectedRoots) {
        const row = readRoot.get(id)
        if (!row || row.value !== value || (transferRootIds.has(id) && row.qualityFlagStatus === "pending")) {
            throw new Error(`Root #${id} changed after review`)
        }
    }

    const time = new Date().toISOString()
    const audit = db.prepare(`
        INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userEmail)
        VALUES (?, ?, ?, ?, ?, ?, 'script:review-morpheme-affixes-10')
    `)
    const flavor = db.prepare<[], { id: number }>("SELECT id FROM allophone_flavors WHERE code = 'CORE'").get()
    if (!flavor) throw new Error("CORE is required")
    const core = db.prepare<[number, number], { id: number; value: string }>(
        "SELECT id, value FROM morpheme_allophones WHERE morphemeId = ? AND flavorId = ?"
    )
    const addCore = db.prepare("INSERT INTO morpheme_allophones (morphemeId, flavorId, value) VALUES (?, ?, ?)")
    const byName = db.prepare<[string], { id: number }>("SELECT id FROM morphemes WHERE type = 0 AND value = ? ORDER BY id")
    const byNameOrCore = db.prepare<[number, string, string], { id: number; value: string; core: string | null }>(`
        SELECT m.id, m.value, a.value AS core FROM morphemes m
        LEFT JOIN morpheme_allophones a ON a.morphemeId = m.id AND a.flavorId = ?
        WHERE m.type = 0 AND (m.value = ? OR a.value = ?)
    `)
    const readLinks = db.prepare<[number], { morphemeId: number; type: number }>(`
        SELECT DISTINCT j.morphemeId, m.type FROM lexemes_morphemes j
        JOIN morphemes m ON m.id = j.morphemeId WHERE j.lexemeId = ? ORDER BY j.morphemeId
    `)
    const getMembers = db.prepare<[number], { lexemeId: number }>(
        "SELECT DISTINCT lexemeId FROM lexemes_morphemes WHERE morphemeId = ? ORDER BY lexemeId"
    )
    const decision = new Map<number, { add: Set<number>; remove: Set<number> }>()
    function plan(lexemeId: number) {
        const item = decision.get(lexemeId) ?? { add: new Set<number>(), remove: new Set<number>() }
        decision.set(lexemeId, item)
        return item
    }
    for (const [target, base, rootId] of transfers) {
        if (!readLinks.all(base).some((x) => x.morphemeId === rootId) ||
            readLinks.all(target).some((x) => x.type === 0 && x.morphemeId !== rootId)) {
            throw new Error(`Reviewed shared root changed for #${target} / #${base}`)
        }
        plan(target).add.add(rootId)
    }
    for (const [id, rootId] of detached) plan(id).remove.add(rootId)

    let correctedRoots = 0
    let createdRoots = 0
    for (const correction of corrections) {
        const { id, original, value, core: spelling, onlyMember, additions } = correction
        const current = readRoot.get(id)
        const variant = core.get(id, flavor.id)
        for (const member of additions) plan(member).add.add(id)
        if (current?.value === value && variant?.value === spelling) continue
        const others = "otherRoot" in correction ? [correction.otherRoot] : []
        if (!current || current.value !== original || current.protoSlavicWordId !== null ||
            current.stressPosition !== null || current.meaning !== null || current.qualityFlagStatus !== null ||
            variant?.value !== original || getMembers.all(id).map((x) => x.lexemeId).join() !== String(onlyMember) ||
            byName.all(value).map((x) => x.id).join() !== others.join() ||
            db.prepare("SELECT count(*) n FROM morpheme_allophones WHERE morphemeId=?").pluck().get(id) !== 1) {
            throw new Error(`Root boundary or family #${id} changed since review`)
        }
        console.log(`#${id} ${original} → ${value}, CORE ${spelling}`)
        correctedRoots++
        if (!apply) continue
        const meaning = "meaning" in correction ? correction.meaning : null
        db.prepare("UPDATE morphemes SET value=?,meaning=?,updatedAt=? WHERE id=?").run(value, meaning, time, id)
        db.prepare("UPDATE morpheme_allophones SET value=? WHERE id=?").run(spelling, variant.id)
        const action = randomUUID()
        audit.run(action, "Morpheme", id, "value", original, value)
        audit.run(action, "Morpheme", id, "CORE", original, spelling)
        if (meaning) audit.run(action, "Morpheme", id, "meaning", null, meaning)
    }

    for (const family of newFamilies) {
        const matches = byNameOrCore.all(flavor.id, family.value, family.core)
        if (matches.length > 1 || (matches.length === 1 &&
            (matches[0].value !== family.value || matches[0].core !== family.core))) {
            throw new Error(`Ambiguous existing root ${family.value}`)
        }
        let id = matches[0]?.id
        if (id === undefined) {
            console.log(`Новый корень ${family.value}, CORE ${family.core}`)
            id = -++createdRoots
            if (apply) {
                id = Number(db.prepare("INSERT INTO morphemes (value,type,updatedAt) VALUES (?,0,?)").run(family.value, time).lastInsertRowid)
                addCore.run(id, flavor.id, family.core)
                const action = randomUUID()
                audit.run(action, "Morpheme", id, "value", null, family.value)
                audit.run(action, "Morpheme", id, "type", null, "0")
                audit.run(action, "Morpheme", id, "CORE", null, family.core)
            }
        }
        for (const member of family.members) plan(member).add.add(id)
    }

    const affix = db.prepare<[number, number, string]>("SELECT id FROM morphemes WHERE id=? AND type=? AND value=?")
    if (!affix.get(1722, 1, "ne") || !affix.get(1738, 2, "ost")) throw new Error("Affix inventory changed")
    plan(12808).add.add(1722)
    plan(12807).add.add(1722)
    const ostCore = core.get(1738, flavor.id)
    if (ostCore && ostCore.value !== "osť") throw new Error("Unexpected CORE variant for -ost")
    if (!ostCore && apply) {
        addCore.run(1738, flavor.id, "osť")
        audit.run(randomUUID(), "Morpheme", 1738, "CORE", null, "osť")
    }

    const touch = db.prepare("UPDATE lexemes SET updatedAt = ? WHERE id = ?")
    const insert = db.prepare("INSERT INTO lexemes_morphemes (lexemeId,morphemeId) VALUES (?,?)")
    const del = db.prepare("DELETE FROM lexemes_morphemes WHERE lexemeId=? AND morphemeId=?")
    let addedLinks = 0
    let removedLinks = 0
    for (const [id, { add, remove }] of decision) {
        const before = readLinks.all(id).map((x) => x.morphemeId)
        const after = new Set(before)
        const dropped = [...remove].filter((root) => after.delete(root))
        const attached = [...add].filter((root) => !after.has(root))
        if (!dropped.length && !attached.length) continue
        attached.forEach((root) => after.add(root))
        addedLinks += attached.length
        removedLinks += dropped.length
        console.log(`#${id}: +[${attached.join(", ")}] −[${dropped.join(", ")}]`)
        if (!apply) continue
        dropped.forEach((root) => del.run(id, root))
        attached.forEach((root) => insert.run(id, root))
        touch.run(time, id)
        audit.run(randomUUID(), "Lexeme", id, "morphemeIds", JSON.stringify(before), JSON.stringify([...after].sort((a, b) => a - b)))
    }
    console.log(JSON.stringify({ apply, correctedRoots, createdRoots, addedLinks, removedLinks, newOstCore: Number(!ostCore) }))
}

try {
    const transaction = db.transaction(run)
    if (apply) transaction.immediate()
    else transaction.deferred()
} finally {
    db.close()
}
