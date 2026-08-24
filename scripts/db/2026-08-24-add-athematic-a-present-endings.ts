// Добавляет третий класс окончаний настоящего времени —
// verb_present_athematic_a — краткую парадигму глаголов на -ati
// ("znam/znaš/zna/znamo/znate/znajut"), существующую в ISV параллельно
// тематической ("znajų/znaješ/znaje"). Согласовано с мейнтейнером
// 2026-08-24: её берут все глаголы на -ati.
//
// Отдельный скрипт, а не перезапуск scripts/db/seed-endings.ts: тот
// переписывает всю таблицу целиком и затёр бы ручные правки модератора,
// сделанные через /admin/endings с момента последнего сева. Здесь
// вставляются только недостающие девять строк.
//
// Идемпотентен: существующие строки не трогает.
//
// Usage: npx tsx -r dotenv/config scripts/db/2026-08-24-add-athematic-a-present-endings.ts [--apply]

import { prismaData } from "@/lib/prisma"

const STEM_TYPE = "verb_present_athematic_a"

const ENDINGS: Array<{ grammeme: string; value: string }> = [
    { grammeme: "Person=1|Number=Sing|Tense=Pres|VerbForm=Fin", value: "m" },
    { grammeme: "Person=2|Number=Sing|Tense=Pres|VerbForm=Fin", value: "š" },
    { grammeme: "Person=3|Number=Sing|Tense=Pres|VerbForm=Fin", value: "" },
    { grammeme: "Person=1|Number=Dual|Tense=Pres|VerbForm=Fin", value: "vě" },
    { grammeme: "Person=2|Number=Dual|Tense=Pres|VerbForm=Fin", value: "ta" },
    { grammeme: "Person=3|Number=Dual|Tense=Pres|VerbForm=Fin", value: "ta" },
    { grammeme: "Person=1|Number=Plur|Tense=Pres|VerbForm=Fin", value: "mo" },
    { grammeme: "Person=2|Number=Plur|Tense=Pres|VerbForm=Fin", value: "te" },
    { grammeme: "Person=3|Number=Plur|Tense=Pres|VerbForm=Fin", value: "jut" },
]

async function main() {
    const apply = process.argv.includes("--apply")

    const existing = await prismaData.endingAllophone.findMany({
        where: { stemType: STEM_TYPE },
        select: { grammeme: true },
    })
    const have = new Set(existing.map((e) => e.grammeme))
    const missing = ENDINGS.filter((e) => !have.has(e.grammeme))

    console.log(`${STEM_TYPE}: уже есть ${have.size}, добавить ${missing.length}`)
    for (const m of missing) console.log(`  ${m.grammeme} -> "${m.value}"`)

    if (missing.length === 0 || !apply) {
        if (missing.length > 0) console.log(`\nЭто прогон вхолостую. Повторите с --apply.`)
        return
    }

    // flavorId=1 (CORE) — те же значения, что и у двух существующих классов
    // настоящего времени; регионального расхождения тут нет.
    const coreFlavor = await prismaData.allophoneFlavor.findFirst({ where: { code: "CORE" }, select: { id: true } })
    if (!coreFlavor) throw new Error("Не найден флейвор CORE")

    await prismaData.endingAllophone.createMany({
        data: missing.map((m) => ({ stemType: STEM_TYPE, grammeme: m.grammeme, value: m.value, flavorId: coreFlavor.id })),
    })
    console.log(`Добавлено строк: ${missing.length}`)
}

main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prismaData.$disconnect())
