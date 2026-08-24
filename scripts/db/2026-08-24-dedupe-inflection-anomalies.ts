// Убирает точные дубликаты в inflection_anomalies: одна и та же тройка
// (lexemeId, inflection, grammeme) занесена дважды. На момент написания —
// 16 строк из 238, все 8 форм "byti" продублированы.
//
// Почему это важно, хотя индекс их и так схлопывает: buildInflectionAnomalyIndex
// дедуплицирует на своей стороне (иначе matchCount у затронутых слов удваивался
// бы на ровном месте), но защита в потребителе — не повод оставлять кривые
// данные, которые видит и правит модератор через /admin/words.
//
// Оставляет строку с наименьшим id, удаляет остальные. Идемпотентен.
//
// Usage: npx tsx -r dotenv/config scripts/db/2026-08-24-dedupe-inflection-anomalies.ts [--apply]

import { prismaData } from "@/lib/prisma"

async function main() {
    const apply = process.argv.includes("--apply")

    const rows = await prismaData.inflectionAnomaly.findMany({
        select: { id: true, lexemeId: true, inflection: true, grammeme: true },
        orderBy: { id: "asc" },
    })

    const seen = new Set<string>()
    const doomed: typeof rows = []
    for (const r of rows) {
        const key = `${r.lexemeId}|${r.inflection}|${r.grammeme}`
        if (seen.has(key)) doomed.push(r)
        else seen.add(key)
    }

    console.log(`Всего строк: ${rows.length}, уникальных: ${seen.size}, дубликатов: ${doomed.length}`)
    for (const d of doomed) {
        console.log(`  id=${d.id} lexemeId=${d.lexemeId} "${d.inflection}" (${d.grammeme})`)
    }

    if (doomed.length === 0) return
    if (!apply) {
        console.log(`\nЭто прогон вхолостую. Повторите с --apply, чтобы удалить.`)
        return
    }

    const result = await prismaData.inflectionAnomaly.deleteMany({ where: { id: { in: doomed.map((d) => d.id) } } })
    console.log(`\nУдалено строк: ${result.count}`)
}

main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prismaData.$disconnect())
