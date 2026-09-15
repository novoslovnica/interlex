// Переводит окончания причастий в ending_allophones (CORE) с праславянских на
// современные. Решение принято по частотам в корпусе, а не по памяти:
//
//   действ. наст.:  -ųšti/-ęťi -> -ųči/-ęči   (govoreči 277, imajuči 155,
//                   slědujučih 79; govoreći 1, pišųći 6)
//   страд. наст.:   -omyj/-emyj/-imyj -> -omy/-emy/-imy   (znajemy 222, vidimy 50)
//   страд. прош.:   -nyj/-enyj/-tyj -> -ny/-eny/-ty   (napisany 116, stvorjeny 198,
//                   byty 29, vzety 24)
//   мн. ч. муж. р.: -ne/-ene/-te/-ome/-eme/-ime -> -ni/-eni/-ti/-omi/-emi/-imi —
//                   это клетка Gender=Masc|Number=Plur, а у твёрдого прилагательного
//                   именительный мн. мужского рода на -i (napisani), -e — женский.
//
// Меняется только строка, в которой всё ещё стоит старое значение: если
// модератор уже поправил окончание в /admin/endings, скрипт его не трогает.
// Идемпотентен. Перед --apply сделайте копию interlex.db.
//
// Usage: npx tsx -r dotenv/config scripts/db/2026-09-15-modernize-participle-endings.ts [--apply]

import { prismaData } from "@/lib/prisma"

function grammeme(gender: string, number: string, tense: string, voice: string): string {
    return `Gender=${gender}|Number=${number}|VerbForm=Part|Tense=${tense}|Voice=${voice}`
}

// [stemType, time, voice, [MascSing, FemSing, NeutSing, MascPlur] как [старое, новое]]
type Pair = [string, string]
const CHANGES: [string, string, string, Pair[]][] = [
    ["verb_part_act_pres_i", "Pres", "Act", [["ęťi", "ęči"], ["ęťa", "ęča"], ["ęťe", "ęče"], ["ęťi", "ęči"]]],
    ["verb_part_act_pres_th", "Pres", "Act", [["ųšti", "ųči"], ["ųťa", "ųča"], ["ųťe", "ųče"], ["ųťi", "ųči"]]],
    ["verb_part_pass_pres_e", "Pres", "Pass", [["emyj", "emy"], ["ema", "ema"], ["emo", "emo"], ["eme", "emi"]]],
    ["verb_part_pass_pres_i", "Pres", "Pass", [["imyj", "imy"], ["ima", "ima"], ["imo", "imo"], ["ime", "imi"]]],
    ["verb_part_pass_pres_th", "Pres", "Pass", [["omyj", "omy"], ["oma", "oma"], ["omo", "omo"], ["ome", "omi"]]],
    ["verb_part_pass_past_en", "Past", "Pass", [["enyj", "eny"], ["ena", "ena"], ["eno", "eno"], ["ene", "eni"]]],
    ["verb_part_pass_past_n", "Past", "Pass", [["nyj", "ny"], ["na", "na"], ["no", "no"], ["ne", "ni"]]],
    ["verb_part_pass_past_t", "Past", "Pass", [["tyj", "ty"], ["ta", "ta"], ["to", "to"], ["te", "ti"]]],
]
const CELLS: [string, string][] = [["Masc", "Sing"], ["Fem", "Sing"], ["Neut", "Sing"], ["Masc", "Plur"]]

async function main() {
    const apply = process.argv.includes("--apply")
    const core = await prismaData.allophoneFlavor.findUnique({ where: { code: "CORE" } })
    if (!core) throw new Error("CORE flavor not found")

    let toChange = 0
    let alreadyModern = 0
    let editedByModerator = 0

    for (const [stemType, tense, voice, pairs] of CHANGES) {
        for (let i = 0; i < CELLS.length; i++) {
            const [oldValue, newValue] = pairs[i]
            if (oldValue === newValue) continue
            const [gender, number] = CELLS[i]
            const g = grammeme(gender, number, tense, voice)
            const rows = await prismaData.endingAllophone.findMany({
                where: { stemType, grammeme: g, flavorId: core.id },
                select: { id: true, value: true },
            })
            for (const row of rows) {
                if (row.value === newValue) {
                    alreadyModern++
                } else if (row.value === oldValue) {
                    toChange++
                    console.log(`  ${stemType} ${g}: "${oldValue}" -> "${newValue}"`)
                    if (apply) await prismaData.endingAllophone.update({ where: { id: row.id }, data: { value: newValue } })
                } else {
                    editedByModerator++
                    console.log(`  ПРОПУЩЕНО ${stemType} ${g}: стоит "${row.value}", не "${oldValue}" — правка модератора`)
                }
            }
        }
    }

    console.log(`\nК замене: ${toChange}, уже современные: ${alreadyModern}, пропущено (правка модератора): ${editedByModerator}`)
    if (!apply && toChange > 0) console.log("Это прогон вхолостую. Повторите с --apply, чтобы записать.")
}

main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prismaData.$disconnect())
