import { randomUUID } from "node:crypto"
import Database from "better-sqlite3"

// Restore the confirmed CORE values from the September 15 corpus and
// grammar review. Match each old value in its exact cell to preserve edits.
const families = [
    ["verb_part_act_pres_i", "Pres", "Act", [["ęťi", "ęči"], ["ęťa", "ęča"], ["ęťe", "ęče"], ["ęťi", "ęči"]]],
    ["verb_part_act_pres_th", "Pres", "Act", [["ųšti", "ųči"], ["ųťa", "ųča"], ["ųťe", "ųče"], ["ųťi", "ųči"]]],
    ["verb_part_pass_pres_e", "Pres", "Pass", [["emyj", "emy"], null, null, ["eme", "emi"]]],
    ["verb_part_pass_pres_i", "Pres", "Pass", [["imyj", "imy"], null, null, ["ime", "imi"]]],
    ["verb_part_pass_pres_th", "Pres", "Pass", [["omyj", "omy"], null, null, ["ome", "omi"]]],
    ["verb_part_pass_past_en", "Past", "Pass", [["enyj", "eny"], null, null, ["ene", "eni"]]],
    ["verb_part_pass_past_n", "Past", "Pass", [["nyj", "ny"], null, null, ["ne", "ni"]]],
    ["verb_part_pass_past_t", "Past", "Pass", [["tyj", "ty"], null, null, ["te", "ti"]]],
] as const
const cells = ["Gender=Masc|Number=Sing", "Gender=Fem|Number=Sing", "Gender=Neut|Number=Sing", "Gender=Masc|Number=Plur"]

const apply = process.argv.includes("--apply")
const db = new Database(process.env.SQLITE_DB ?? "interlex.db", { readonly: !apply, fileMustExist: true })

try {
    const find = db.prepare<[string, string], { id: number; value: string }>(`
        SELECT a.id, a.value
        FROM ending_allophones a JOIN allophone_flavors f ON f.id = a.flavorId
        WHERE f.code = 'CORE' AND a.stemType = ? AND a.grammeme = ?
    `)

    function plan() {
        const changes = []
        for (const [stem, tense, voice, pairs] of families) {
            for (const [index, pair] of pairs.entries()) {
                if (!pair) continue
                const [oldValue, newValue] = pair
                const grammeme = `${cells[index]}|VerbForm=Part|Tense=${tense}|Voice=${voice}`
                const cell = find.get(stem, grammeme)
                if (cell?.value === oldValue) {
                    changes.push({ id: cell.id, stem, grammeme, oldValue, newValue })
                } else if (cell?.value !== newValue) {
                    console.log(`Пропуск ${stem} ${grammeme}: ${cell?.value ?? "строка отсутствует"}`)
                }
            }
        }
        return changes
    }

    const changes = apply ? db.transaction(() => {
        const update = db.prepare("UPDATE ending_allophones SET value = ? WHERE id = ?")
        const audit = db.prepare(`
            INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userEmail)
            VALUES (?, 'EndingAllophone', ?, 'value', ?, ?, 'script:restore-modern-participle-endings')
        `)
        const planned = plan()
        const actionId = randomUUID()
        for (const { id, oldValue, newValue } of planned) {
            update.run(newValue, id)
            audit.run(actionId, id, oldValue, newValue)
        }
        return planned
    }).immediate() : plan()

    for (const { stem, grammeme, oldValue, newValue } of changes) {
        console.log(`${stem} ${grammeme}: ${oldValue} → ${newValue}`)
    }
    console.log(`${apply ? "Применено" : "К замене"}: ${changes.length}`)
} finally {
    db.close()
}
