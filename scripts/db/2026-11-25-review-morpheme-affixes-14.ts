import { randomUUID } from "node:crypto"
import Database from "better-sqlite3"

// After the verified transfers to prefix pri-, the remaining records still
// pointing at old #1718 cover compounds, prepositional phrases and other
// families. The root flag identifies the incorrect cluster. These edits
// detach that cluster; individual uncertain prefix analyses stay in pass 13.
const reviewed = [
    [2638, "pribeg-NOUN", "pribeg", "priběg"],
    [2650, "prijazny-adj", "priiazny", "prijazn"],
    [2660, "prikljuceniie-NOUN", "prikljuceniie", "priključeni"],
    [2663, "priljubleny-adj", "priljubleny", "priljublen"],
    [2664, "primizavati-VERB", "primizavati", "primižava"],
    [2666, "prinudzlivy-ADJ", "prinudzlivy", "prinudžliv"],
    [2667, "pripojka-n", "pripojka", "pripojk"],
    [2670, "prislovec-n", "prislovec", "prislovec"],
    [2673, "pritca-NOUN", "pritca", "pritč"],
    [2674, "pritezateljny-ADJ", "pritezateljny", "pritęžateljn"],
    [2675, "priton-n", "priton", "priton"],
    [2680, "privodka-n", "privodka", "privodk"],
    [5400, "bezpricinny-ADJ", "bezpricinny", "bezpričinn"],
    [5401, "bezprikladny-ADJ", "bezprikladny", "bezprikladn"],
    [5402, "bezprimerny-ADJ", "bezprimerny", "bezpriměrn"],
    [5514, "blagoprijatny-ADJ", "blagoprijatny", "blågoprijatn"],
    [5888, "byti prinudeny-VERB", "byti prinudeny", "byti prinuđeny"],
    [7917, "gosteprijemny-ADJ", "gosteprijemny", "gosteprijėmn"],
    [7918, "gosteprijemstvo-NOUN", "gosteprijemstvo", "gosteprijėmstv"],
    [10400, "krivopriseznicstvo-NOUN", "krivopriseznicstvo", "krivoprisęžničstv"],
    [10440, "krovny pritisk-NOUN", "krovny pritisk", "krȯvny pritisk"],
    [12024, "nadprirodny-ADJ", "nadprirodny", "nadprirodn"],
    [12253, "napriklad-ADV", "napriklad", "napriklad"],
    [12254, "naprimer-ADV", "naprimer", "napriměr"],
    [12750, "neprigodnost-NOUN", "neprigodnost", "neprigodnosť"],
    [12751, "neprigodny-ADJ", "neprigodny", "neprigodn"],
    [12752, "neprijatelj-NOUN", "neprijatelj", "neprijatel"],
    [12753, "neprijateljsky-ADJ", "neprijateljsky", "neprijateljsk"],
    [12754, "neprijateljstvo-NOUN", "neprijateljstvo", "neprijateljstv"],
    [12755, "neprijatnost-NOUN", "neprijatnost", "neprijatnosť"],
    [12756, "neprijatny-ADJ", "neprijatny", "neprijatn"],
    [12757, "neprijemlivy-ADJ", "neprijemlivy", "neprijėmliv"],
    [12758, "neprijemnost-NOUN", "neprijemnost", "neprijėmnosť"],
    [12759, "neprijemny-ADJ", "neprijemny", "neprijėmn"],
    [12760, "neprimetny-ADJ", "neprimetny", "neprimětn"],
    [12761, "neprirodny-ADJ", "neprirodny", "neprirodn"],
    [12762, "nepristojnost-NOUN", "nepristojnost", "nepristojnosť"],
    [12763, "nepristojny-ADJ", "nepristojny", "nepristojn"],
    [12764, "nepristupnost-NOUN", "nepristupnost", "nepristųpnosť"],
    [12765, "nepristupny-ADJ", "nepristupny", "nepristųpn"],
    [12766, "nepritomny-ADJ", "nepritomny", "nepritomn"],
    [12767, "neprivykly-ADJ", "neprivykly", "neprivykl"],
    [13065, "novopriselec-NOUN", "novopriselec", "novoprišėlėc"],
    [14601, "para prikladov-NOUN", "para prikladov", "para prikladov"],
    [14967, "po pricine-ADP", "po pricine", "po pričině"],
    [16000, "predprijemstvo-NOUN", "predprijemstvo", "prědprijėmstv"],
    [16001, "predprijeti-VERB", "predprijeti", "prědpriję"],
    [16002, "predprijmati-VERB", "predprijmati", "prědprijma"],
    [16003, "predprimetny-ADJ", "predprimetny", "prědprimetn"],
    [16312, "priblizno, priblizno-ADV", "priblizno, priblizno", "priblizno, približn"],
    [16316, "pribor-NOUN", "pribor", "pribor"],
    [16321, "pricep-NOUN", "pricep", "pričep"],
    [16322, "pricestje-NOUN", "pricestje", "pričęsť"],
    [16332, "pridavnik-NOUN", "pridavnik", "pridavnik"],
    [16341, "prigadati se-VERB", "prigadati se", "prigađa"],
    [16347, "prigoda-NOUN", "prigoda", "prigod"],
    [16348, "prigoditi se-VERB", "prigoditi se", "prigodi"],
    [16349, "prigodny-ADJ", "prigodny", "prigodn"],
    [16357, "prijateliti se-VERB", "prijateliti se", "prijateli"],
    [16358, "prijatelj-NOUN", "prijatelj", "prijatel"],
    [16359, "prijateljka-NOUN", "prijateljka", "prijateljk"],
    [16360, "prijateljska igra-NOUN", "prijateljska igra", "prijateljska igr"],
    [16361, "prijateljska strelba-NOUN", "prijateljska strelba", "prijateljska strěľb"],
    [16362, "prijateljskost-NOUN", "prijateljskost", "prijateljskosť"],
    [16363, "prijateljsky-ADJ", "prijateljsky", "prijateljsk"],
    [16364, "prijateljstvo-NOUN", "prijateljstvo", "prijateljstv"],
    [16365, "prijati-VERB", "prijati", "prija"],
    [16366, "prijatlivy-ADJ", "prijatlivy", "prijatliv"],
    [16367, "prijatno-ADV", "prijatno", "prijatn"],
    [16368, "prijatnost-NOUN", "prijatnost", "prijatnosť"],
    [16369, "prijatny-ADJ", "prijatny", "prijatn"],
    [16375, "prijemlivy-ADJ", "prijemlivy", "prijėmliv"],
    [16377, "prijemnost-NOUN", "prijemnost", "prijėmnosť"],
    [16378, "prijemny-ADJ", "prijemny", "prijėmn"],
    [16379, "prijeti se-VERB", "prijeti se", "priję"],
    [16383, "prijmajuca krajina-NOUN", "prijmajuca krajina", "prijmajųća krajin"],
    [16384, "prijmati se-VERB", "prijmati se", "prijma"],
    [16389, "priklad-NOUN", "priklad", "priklad"],
    [16392, "prilagateljno ime-NOUN", "prilagateljno ime", "prilagateljno imen"],
    [16398, "prilicny-ADJ", "prilicny", "priličn"],
    [16403, "prilucati se-VERB", "prilucati se", "prilųča"],
    [16404, "prilucati-VERB", "prilucati", "prilųča"],
    [16405, "priluciti se-VERB", "priluciti se", "prilųči"],
    [16406, "priluciti-VERB", "priluciti", "prilųči"],
    [16457, "priroda-NOUN", "priroda", "prirod"],
    [16462, "prirodny-ADJ", "prirodny", "prirodn"],
] as const

const apply = process.argv.includes("--apply")
const file = process.env.SQLITE_DB
if (!file) throw new Error("SQLITE_DB is required. Use npm run db:run.")
const db = new Database(file, { readonly: !apply, fileMustExist: true })
db.pragma("foreign_keys = ON")
db.pragma("busy_timeout = 10000")

function run() {
    const oldRootId = 1718
    const verifiedPrefix = db.prepare("SELECT id FROM morphemes WHERE value='pri' AND type=1").all()
    if (verifiedPrefix.length !== 1) throw new Error("Expected a single verified prefix pri-")
    const legacy = db.prepare<[number], { qualityFlagStatus: string }>(`
        SELECT qualityFlagStatus FROM morphemes
        WHERE id=? AND type=0 AND value='pri' AND qualityFlag='affix_collision_prefix'
    `).get(oldRootId)
    if (!legacy) throw new Error("The old root cluster #1718 changed")
    const current = db.prepare<[number], { id: number; slug: string; value: string; stem: string | null }>(`
        SELECT DISTINCT l.id,l.slug,l.value,l.stem FROM lexemes_morphemes lm
        JOIN lexemes l ON l.id=lm.lexemeId WHERE lm.morphemeId=? ORDER BY l.id
    `).all(oldRootId)
    if (legacy.qualityFlagStatus === "resolved" && current.length === 0) {
        console.log(JSON.stringify({ apply, removedLinks: 0, resolved: true }))
        return
    }
    if (legacy.qualityFlagStatus !== "pending" ||
        JSON.stringify(current.map(({ id, slug, value, stem }) => [id, slug, value, stem])) !== JSON.stringify(reviewed)) {
        throw new Error("The remaining legacy links changed. Apply pass 13 first, then recheck this list.")
    }
    const audit = db.prepare(`
        INSERT INTO audit_logs (actionId,entityType,entityId,field,oldValue,newValue,userEmail)
        VALUES (?, ?, ?, ?, ?, ?, 'script:review-morpheme-affixes-14')
    `)
    const readLinks = db.prepare<[number], { morphemeId: number }>(`
        SELECT DISTINCT morphemeId FROM lexemes_morphemes
        WHERE lexemeId=? AND morphemeId IS NOT NULL ORDER BY morphemeId
    `)
    const remove = db.prepare("DELETE FROM lexemes_morphemes WHERE lexemeId=? AND morphemeId=?")
    const touch = db.prepare("UPDATE lexemes SET updatedAt=? WHERE id=?")
    const time = new Date().toISOString()
    for (const { id, value } of current) {
        console.log(`#${id} ${value}: снять старый корневой тег pri`)
        if (!apply) continue
        const before = readLinks.all(id).map(({ morphemeId }) => morphemeId)
        remove.run(id, oldRootId)
        touch.run(time, id)
        audit.run(randomUUID(), "Lexeme", id, "morphemeIds", JSON.stringify(before), JSON.stringify(before.filter((m) => m !== oldRootId)))
    }
    if (apply) {
        db.prepare("UPDATE morphemes SET qualityFlagStatus='resolved',qualityFlagReviewedAt=?,updatedAt=? WHERE id=?")
            .run(time, time, oldRootId)
        audit.run(randomUUID(), "Morpheme", oldRootId, "qualityFlagStatus", "pending", "resolved")
    }
    console.log(JSON.stringify({ apply, removedLinks: current.length, resolved: apply }))
}

try {
    const transaction = db.transaction(run)
    if (apply) transaction.immediate()
    else transaction.deferred()
} finally {
    db.close()
}
